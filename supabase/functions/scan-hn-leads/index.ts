// Edge Function: scan-hn-leads
// Job de fundo que varre a thread mensal "Ask HN: Who is hiring?" do Hacker
// News (API pública Algolia, sem chave) atrás de vagas com sinal de
// contrato/freelance, e grava as que baterem em dev_leads.
//
// Sem secrets necessários — hn.algolia.com é uma API pública sem autenticação.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const KEYWORDS = ["contract", "freelance", "contractor", "part-time", "part time"];

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

function matchKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  return KEYWORDS.filter((kw) => lower.includes(kw));
}

async function findWhoIsHiringStory(): Promise<{ objectID: string; title: string }> {
  const res = await fetch(
    "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5",
  );
  if (!res.ok) throw new Error(`HN Algolia respondeu ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const hits = (body.hits ?? []) as Array<{ objectID: string; title?: string }>;
  // A busca por author_whoishiring traz tanto "Who is hiring?" quanto "Who
  // wants to be hired?" (postadas juntas todo mês) — filtramos pelo título.
  const match = hits.find((h) => (h.title ?? "").toLowerCase().includes("who is hiring"));
  if (!match) throw new Error("Não encontrei a thread 'Who is hiring?' mais recente.");
  return { objectID: match.objectID, title: match.title ?? "" };
}

async function fetchTopLevelComments(storyId: string): Promise<
  Array<{ objectID: string; author: string | null; comment_text: string | null; created_at: string }>
> {
  const all: Array<{ objectID: string; author: string | null; comment_text: string | null; created_at: string }> = [];
  let page = 0;
  // Um mês costuma ter algumas centenas de comentários de topo — 3 páginas de
  // 1000 é bem mais que suficiente e evita loop indefinido.
  const MAX_PAGES = 3;

  while (page < MAX_PAGES) {
    const params = new URLSearchParams({
      tags: `comment,story_${storyId}`,
      numericFilters: `parent_id=${storyId}`,
      hitsPerPage: "1000",
      page: String(page),
    });
    const res = await fetch(`https://hn.algolia.com/api/v1/search?${params.toString()}`);
    if (!res.ok) throw new Error(`HN Algolia respondeu ${res.status}: ${await res.text()}`);
    const body = await res.json();
    const hits = (body.hits ?? []) as typeof all;
    all.push(...hits);
    if (hits.length < 1000) break;
    page++;
  }

  return all;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const story = await findWhoIsHiringStory();
    const comments = await fetchTopLevelComments(story.objectID);

    let matchesFound = 0;
    let upserted = 0;

    for (const comment of comments) {
      const text = comment.comment_text ?? "";
      const matched = matchKeywords(text);
      if (matched.length === 0) continue;
      matchesFound++;

      const { error } = await supabase.from("dev_leads").upsert(
        {
          external_id: comment.objectID,
          author: comment.author,
          snippet: stripHtml(text),
          url: `https://news.ycombinator.com/item?id=${comment.objectID}`,
          posted_at: comment.created_at,
          matched_keywords: matched,
        },
        { onConflict: "external_id" },
      );
      if (error) {
        console.error("Falha ao salvar", comment.objectID, error);
        continue;
      }
      upserted++;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        thread: story.title,
        total_comments: comments.length,
        matches_found: matchesFound,
        upserted,
      }),
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
