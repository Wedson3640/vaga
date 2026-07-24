import { supabase } from "./supabase";
import type { DevLead } from "@/types/lead";

export async function getLeads(): Promise<DevLead[]> {
  const { data, error } = await supabase
    .from("dev_leads")
    .select("*")
    .order("posted_at", { ascending: false });

  if (error) {
    console.error("Falha ao buscar dev_leads:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    author: row.author,
    snippet: row.snippet,
    url: row.url,
    postedAt: row.posted_at,
    matchedKeywords: row.matched_keywords ?? [],
  }));
}
