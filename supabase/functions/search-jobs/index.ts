// Edge Function: search-jobs
// Recebe um search_request_id, busca vagas reais na Adzuna e na Jooble em paralelo,
// remove duplicatas óbvias, calcula um score simples de compatibilidade por
// palavra-chave e grava tudo no Supabase.
//
// Secrets necessários (supabase secrets set ...):
//   ADZUNA_APP_ID, ADZUNA_APP_KEY, JOOBLE_API_KEY (opcional — sem ela, só busca na Adzuna)
// Variáveis já injetadas automaticamente pela plataforma:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADZUNA_APP_ID = Deno.env.get("ADZUNA_APP_ID")!;
const ADZUNA_APP_KEY = Deno.env.get("ADZUNA_APP_KEY")!;
const JOOBLE_API_KEY = Deno.env.get("JOOBLE_API_KEY");

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type NormalizedJob = {
  source: string;
  external_id: string;
  title: string;
  company: string | null;
  location: string | null;
  description: string;
  url: string | null;
  salary_min: number | null;
  salary_max: number | null;
};

// Stopwords PT/EN comuns — sem isso, "de", "para", "com" etc. viram "palavras-chave"
// e diluem o score de compatibilidade sem sinal nenhum.
const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "em", "para", "por", "com", "sem", "sob", "sobre",
  "um", "uma", "uns", "umas", "os", "as", "que", "se", "sua", "seu", "suas", "seus",
  "the", "and", "for", "with", "from", "this", "that", "are", "was", "were",
]);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 3 && !STOPWORDS.has(word)),
    ),
  );
}

function scoreJob(candidateKeywords: string[], job: { title: string; description: string }) {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  const matched = candidateKeywords.filter((kw) => haystack.includes(kw));
  const score = candidateKeywords.length === 0
    ? 0
    : Math.round((matched.length / candidateKeywords.length) * 100);
  return { score, matched };
}

// Chave simples para detectar a mesma vaga vinda de fontes diferentes (ex: Adzuna e
// Jooble agregando o mesmo anúncio original). Não é robusto a variações de texto, mas
// resolve o caso comum de título/empresa/local idênticos.
function dedupKey(title: string, company: string | null, location: string | null): string {
  return [title, company ?? "", location ?? ""].map((s) => s.trim().toLowerCase()).join("|");
}

async function fetchAdzunaJobs(what: string, where: string | null): Promise<NormalizedJob[]> {
  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    results_per_page: "10",
    what,
    "content-type": "application/json",
  });
  if (where) params.set("where", where);

  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/br/search/1?${params.toString()}`);
  if (!res.ok) throw new Error(`Adzuna respondeu ${res.status}: ${await res.text()}`);
  const body = await res.json();

  const results = (body.results ?? []) as Array<{
    id: string;
    title: string;
    company?: { display_name?: string };
    location?: { display_name?: string };
    description?: string;
    redirect_url?: string;
    salary_min?: number;
    salary_max?: number;
  }>;

  return results.map((job) => ({
    source: "adzuna",
    external_id: job.id,
    title: job.title,
    company: job.company?.display_name ?? null,
    location: job.location?.display_name ?? null,
    description: job.description ?? "",
    url: job.redirect_url ?? null,
    salary_min: job.salary_min ?? null,
    salary_max: job.salary_max ?? null,
  }));
}

async function fetchJoobleJobs(keywords: string, location: string | null): Promise<NormalizedJob[]> {
  // A Jooble só retorna resultados quando "Brazil" aparece em inglês no campo location —
  // "Brasil" (PT) ou só o nome da cidade isolado devolvem 0 resultados sempre, mesmo
  // havendo vagas reais. O nome da cidade não parece filtrar (mesma contagem com ou sem
  // ela), mas mantemos para não perder precisão caso a conta ganhe esse filtro no futuro.
  const joobleLocation = location ? `${location}, Brazil` : "Brazil";
  const res = await fetch(`https://jooble.org/api/${JOOBLE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords, location: joobleLocation }),
  });
  if (!res.ok) throw new Error(`Jooble respondeu ${res.status}: ${await res.text()}`);
  const body = await res.json();

  const jobs = (body.jobs ?? []) as Array<{
    id: number | string;
    title: string;
    company?: string;
    location?: string;
    snippet?: string;
    link?: string;
  }>;

  return jobs.map((job) => ({
    source: "jooble",
    external_id: String(job.id),
    title: job.title,
    company: job.company ?? null,
    location: job.location ?? null,
    description: job.snippet ?? "",
    url: job.link ?? null,
    // A Jooble devolve salário como texto livre (varia de formato/moeda por país),
    // não dá pra converter em salary_min/max com segurança — deixamos em branco.
    salary_min: null,
    salary_max: null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { search_request_id } = await req.json();
    if (!search_request_id) {
      return new Response(JSON.stringify({ error: "search_request_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: searchRequest, error: srError } = await supabase
      .from("search_requests")
      .select("id, candidate_id")
      .eq("id", search_request_id)
      .single();
    if (srError || !searchRequest) throw srError ?? new Error("search_request não encontrada");

    await supabase
      .from("search_requests")
      .update({ status: "processing" })
      .eq("id", search_request_id);

    const { data: candidate, error: candError } = await supabase
      .from("candidates")
      .select("desired_role, location, keywords, resume_text")
      .eq("id", searchRequest.candidate_id)
      .single();
    if (candError || !candidate) throw candError ?? new Error("candidate não encontrado");

    // O texto real do currículo (quando disponível) entra junto do cargo digitado para dar
    // um score de compatibilidade mais honesto do que só repetir os termos da própria busca.
    const keywordSource = candidate.resume_text
      ? `${candidate.desired_role} ${candidate.resume_text}`
      : candidate.desired_role;
    const candidateKeywords = candidate.keywords?.length
      ? candidate.keywords
      : extractKeywords(keywordSource);

    const sourceSearches = [fetchAdzunaJobs(candidate.desired_role, candidate.location)];
    if (JOOBLE_API_KEY) {
      sourceSearches.push(fetchJoobleJobs(candidate.desired_role, candidate.location));
    }

    const settled = await Promise.allSettled(sourceSearches);

    const jobs: NormalizedJob[] = [];
    const seen = new Set<string>();
    for (const result of settled) {
      if (result.status === "rejected") {
        console.error("Uma fonte de vagas falhou:", result.reason);
        continue;
      }
      for (const job of result.value) {
        const key = dedupKey(job.title, job.company, job.location);
        if (seen.has(key)) continue;
        seen.add(key);
        jobs.push(job);
      }
    }

    if (jobs.length === 0 && settled.every((r) => r.status === "rejected")) {
      throw new Error("Todas as fontes de vagas falharam.");
    }

    let insertedCount = 0;
    for (const job of jobs) {
      const { data: posting, error: upsertError } = await supabase
        .from("job_postings")
        .upsert(
          {
            source: job.source,
            external_id: job.external_id,
            title: job.title,
            company: job.company,
            location: job.location,
            description: job.description,
            url: job.url,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "source,external_id" },
        )
        .select("id")
        .single();
      if (upsertError || !posting) throw upsertError ?? new Error("falha ao gravar job_posting");

      const { score, matched } = scoreJob(candidateKeywords, { title: job.title, description: job.description });

      const { error: resultError } = await supabase
        .from("search_results")
        .upsert(
          {
            search_request_id,
            job_posting_id: posting.id,
            match_score: score,
            matched_keywords: matched,
          },
          { onConflict: "search_request_id,job_posting_id" },
        );
      if (resultError) throw resultError;

      insertedCount++;
    }

    await supabase
      .from("search_requests")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", search_request_id);

    return new Response(JSON.stringify({ ok: true, jobs_found: insertedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    try {
      const body = await req.clone().json().catch(() => null);
      if (body?.search_request_id) {
        await supabase
          .from("search_requests")
          .update({ status: "error", error_message: String(err) })
          .eq("id", body.search_request_id);
      }
    } catch {
      // já estamos no caminho de erro; não deixamos um segundo erro mascarar o primeiro
    }
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
