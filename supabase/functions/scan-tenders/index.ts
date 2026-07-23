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
// Modalidades de contratação da Lei 14.133/2021 (código PNCP 2-12). Iteramos por
// todas pra não perder edital de arquitetura publicado numa modalidade incomum
// (ex: Concurso, usado às vezes para concursos de projeto arquitetônico).
const MODALIDADES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const KEYWORDS = ["arquitet", "urbanis", "paisagis"];
const PAGE_SIZE = 50;
// Teto de segurança por combinação UF×modalidade (500 registros) — evita que uma
// modalidade muito movimentada (ex: Pregão Eletrônico) estoure o tempo da function.
const MAX_PAGES_PER_COMBO = 10;
const BATCH_SIZE = 5; // combinações processadas em paralelo por vez

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
  const res = await fetch(`https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`PNCP respondeu ${res.status} (uf=${uf} modalidade=${modalidade} pagina=${pagina}): ${await res.text()}`);
  }
  return res.json();
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
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dataFinal = formatDate(today);
    const dataInicial = formatDate(weekAgo);

    const combos: Array<[string, number]> = [];
    for (const uf of UFS) {
      for (const modalidade of MODALIDADES) {
        combos.push([uf, modalidade]);
      }
    }

    const allMatches: TenderMatch[] = [];
    let failedCombos = 0;

    for (let i = 0; i < combos.length; i += BATCH_SIZE) {
      const batch = combos.slice(i, i + BATCH_SIZE);
      const settled = await Promise.allSettled(
        batch.map(([uf, modalidade]) => scanCombo(uf, modalidade, dataInicial, dataFinal)),
      );
      for (const result of settled) {
        if (result.status === "fulfilled") {
          allMatches.push(...result.value);
        } else {
          failedCombos++;
          console.error("Combinação UF/modalidade falhou:", result.reason);
        }
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
