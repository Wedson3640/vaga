// Edge Function: scan-tenders
// Job de fundo (disparado por cron semanal, não pelo navegador) que varre o
// PNCP (Portal Nacional de Contratações Públicas) atrás de licitações de
// arquitetura nos estados PI, MA, PA e CE dos últimos 7 dias, e grava as que
// batem com as palavras-chave em tender_opportunities.
//
// Sem secrets necessários — a API de consulta do PNCP é pública, sem chave.
// Variáveis já injetadas automaticamente pela plataforma:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const UFS = ["PI", "MA", "PA", "CE"];
// Modalidades de contratação da Lei 14.133/2021 (código PNCP 2-12). Cobrimos
// todas pra não perder edital de arquitetura publicado numa modalidade incomum
// (ex: Concurso, usado às vezes para concursos de projeto arquitetônico).
// Divididas em 2 grupos: há um gateway na frente da Edge Function com timeout
// de ~150s, e uma UF com volume alto (confirmado em teste com CE) não cabe
// processando as 11 de uma vez — por isso cada invocação roda só um grupo.
const MODALIDADE_GROUPS: Record<string, number[]> = {
  "1": [2, 3, 4, 5, 6],
  "2": [7, 8, 9, 10, 11, 12],
};
const KEYWORDS = ["arquitet", "urbanis", "paisagis"];
const PAGE_SIZE = 50;
// Teto de segurança por combinação UF×modalidade (500 registros) — evita que uma
// modalidade muito movimentada (ex: Pregão Eletrônico) estoure o tempo da function.
const MAX_PAGES_PER_COMBO = 10;
// O PNCP tem um rate limit agressivo (confirmado em teste: em torno de 6-7
// chamadas seguidas já derruba em 429, mesmo com ~1s de intervalo; com 3s
// entre chamadas não houve mais erro). Por isso rodamos sequencial, com esse
// intervalo, em vez de paralelizar combinações.
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES_ON_429 = 4;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TenderMatch = {
  pncp_control_number: string;
  objeto: string;
  orgao: string | null;
  uf: string | null;
  municipio: string | null;
  modalidade: string | null;
  valor_estimado: number | null;
  data_publicacao: string | null;
  data_encerramento_proposta: string | null;
  link: string | null;
  matched_keywords: string[];
};

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function matchKeywords(objeto: string): string[] {
  const lower = objeto.toLowerCase();
  return KEYWORDS.filter((kw) => lower.includes(kw));
}

async function fetchPage(
  uf: string,
  modalidade: number,
  pagina: number,
  dataInicial: string,
  dataFinal: string,
) {
  const params = new URLSearchParams({
    dataInicial,
    dataFinal,
    codigoModalidadeContratacao: String(modalidade),
    uf,
    pagina: String(pagina),
    tamanhoPagina: String(PAGE_SIZE),
  });
  const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`;

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_429; attempt++) {
    await sleep(REQUEST_DELAY_MS);
    const res = await fetch(url);
    if (res.status === 429) {
      const backoff = REQUEST_DELAY_MS * (attempt + 2); // espera crescente a cada retry
      console.error(`429 do PNCP (uf=${uf} modalidade=${modalidade} pagina=${pagina}), tentativa ${attempt + 1}, aguardando ${backoff}ms`);
      await sleep(backoff);
      continue;
    }
    if (!res.ok) {
      throw new Error(`PNCP respondeu ${res.status} (uf=${uf} modalidade=${modalidade} pagina=${pagina}): ${await res.text()}`);
    }
    // Quando não há nenhum resultado para a combinação, o PNCP às vezes responde
    // 200 com corpo vazio em vez de um JSON com "data": [] — sem esse tratamento,
    // res.json() quebra com "Unexpected end of JSON input".
    const text = await res.text();
    if (!text) {
      return { data: [], totalPaginas: 1 };
    }
    return JSON.parse(text);
  }
  throw new Error(`PNCP: rate limit persistente (uf=${uf} modalidade=${modalidade} pagina=${pagina})`);
}

async function scanCombo(
  uf: string,
  modalidade: number,
  dataInicial: string,
  dataFinal: string,
): Promise<TenderMatch[]> {
  const matches: TenderMatch[] = [];
  let pagina = 1;
  let totalPaginas = 1;

  do {
    const body = await fetchPage(uf, modalidade, pagina, dataInicial, dataFinal);
    totalPaginas = body.totalPaginas ?? 1;

    const items = (body.data ?? []) as Array<{
      numeroControlePNCP: string;
      objetoCompra?: string;
      orgaoEntidade?: { razaoSocial?: string };
      unidadeOrgao?: { ufSigla?: string; municipioNome?: string };
      modalidadeNome?: string;
      valorTotalEstimado?: number;
      dataPublicacaoPncp?: string;
      dataEncerramentoProposta?: string;
      linkSistemaOrigem?: string;
    }>;

    for (const item of items) {
      const objeto = item.objetoCompra ?? "";
      const matched = matchKeywords(objeto);
      if (matched.length === 0) continue;

      matches.push({
        pncp_control_number: item.numeroControlePNCP,
        objeto,
        orgao: item.orgaoEntidade?.razaoSocial ?? null,
        uf: item.unidadeOrgao?.ufSigla ?? null,
        municipio: item.unidadeOrgao?.municipioNome ?? null,
        modalidade: item.modalidadeNome ?? null,
        valor_estimado: item.valorTotalEstimado ?? null,
        data_publicacao: item.dataPublicacaoPncp ?? null,
        data_encerramento_proposta: item.dataEncerramentoProposta ?? null,
        link: item.linkSistemaOrigem || null,
        matched_keywords: matched,
      });
    }

    pagina++;
  } while (pagina <= totalPaginas && pagina <= MAX_PAGES_PER_COMBO);

  return matches;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Edge Functions do Supabase têm só ~2s de tempo de CPU ativo por chamada
    // (orçamento separado do limite de wall clock), e há um gateway na frente
    // com timeout de ~150s. Por isso cada invocação processa **uma UF e um
    // grupo de modalidades só** — o cron semanal dispara uma chamada por
    // combinação de estado×grupo (ver instruções de configuração: 4 UFs × 2
    // grupos = 8 disparos por semana).
    const body = await req.json().catch(() => ({}));
    const uf = body?.uf;
    const group = String(body?.group ?? "");
    if (!uf || !UFS.includes(uf)) {
      return new Response(
        JSON.stringify({ error: `Informe "uf" no corpo da requisição, um de: ${UFS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!MODALIDADE_GROUPS[group]) {
      return new Response(
        JSON.stringify({ error: `Informe "group" no corpo da requisição, um de: ${Object.keys(MODALIDADE_GROUPS).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const modalidades = MODALIDADE_GROUPS[group];

    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dataFinal = formatDate(today);
    const dataInicial = formatDate(weekAgo);

    const allMatches: TenderMatch[] = [];
    let failedCombos = 0;

    // Sequencial de propósito (ver comentário de REQUEST_DELAY_MS acima) — o PNCP
    // derruba a conexão com 429 se receber várias chamadas em paralelo.
    for (const modalidade of modalidades) {
      try {
        const matches = await scanCombo(uf, modalidade, dataInicial, dataFinal);
        allMatches.push(...matches);
      } catch (err) {
        failedCombos++;
        console.error(`Combinação uf=${uf} modalidade=${modalidade} falhou:`, err);
      }
    }

    let upserted = 0;
    for (const match of allMatches) {
      const { error } = await supabase
        .from("tender_opportunities")
        .upsert(match, { onConflict: "pncp_control_number" });
      if (error) {
        console.error("Falha ao salvar", match.pncp_control_number, error);
        continue;
      }
      upserted++;
    }

    return new Response(
      JSON.stringify({ ok: true, matches_found: allMatches.length, upserted, failed_combos: failedCombos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
