// Edge Function: search-jobs
// Recebe um search_request_id, busca vagas reais na Adzuna, calcula um score
// simples de compatibilidade por palavra-chave e grava tudo no Supabase.
//
// Secrets necessários (supabase secrets set ...):
//   ADZUNA_APP_ID, ADZUNA_APP_KEY
// Variáveis já injetadas automaticamente pela plataforma:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADZUNA_APP_ID = Deno.env.get("ADZUNA_APP_ID")!;
const ADZUNA_APP_KEY = Deno.env.get("ADZUNA_APP_KEY")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function extractKeywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((word) => word.length >= 3),
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
      .select("desired_role, location, keywords")
      .eq("id", searchRequest.candidate_id)
      .single();
    if (candError || !candidate) throw candError ?? new Error("candidate não encontrado");

    const candidateKeywords = candidate.keywords?.length
      ? candidate.keywords
      : extractKeywords(candidate.desired_role);

    const params = new URLSearchParams({
      app_id: ADZUNA_APP_ID,
      app_key: ADZUNA_APP_KEY,
      results_per_page: "10",
      what: candidate.desired_role,
      "content-type": "application/json",
    });
    if (candidate.location) params.set("where", candidate.location);

    const adzunaUrl = `https://api.adzuna.com/v1/api/jobs/br/search/1?${params.toString()}`;
    const adzunaRes = await fetch(adzunaUrl);
    if (!adzunaRes.ok) {
      throw new Error(`Adzuna respondeu ${adzunaRes.status}: ${await adzunaRes.text()}`);
    }
    const adzunaBody = await adzunaRes.json();
    const jobs = (adzunaBody.results ?? []) as Array<{
      id: string;
      title: string;
      company?: { display_name?: string };
      location?: { display_name?: string };
      description?: string;
      redirect_url?: string;
      salary_min?: number;
      salary_max?: number;
    }>;

    let insertedCount = 0;
    for (const job of jobs) {
      const description = job.description ?? "";

      const { data: posting, error: upsertError } = await supabase
        .from("job_postings")
        .upsert(
          {
            source: "adzuna",
            external_id: job.id,
            title: job.title,
            company: job.company?.display_name ?? null,
            location: job.location?.display_name ?? null,
            description,
            url: job.redirect_url ?? null,
            salary_min: job.salary_min ?? null,
            salary_max: job.salary_max ?? null,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "source,external_id" },
        )
        .select("id")
        .single();
      if (upsertError || !posting) throw upsertError ?? new Error("falha ao gravar job_posting");

      const { score, matched } = scoreJob(candidateKeywords, { title: job.title, description });

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
