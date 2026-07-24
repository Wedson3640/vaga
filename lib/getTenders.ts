import { supabase } from "./supabase";
import type { Tender } from "@/types/tender";

const NEW_THRESHOLD_DAYS = 3;

function isRecent(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const daysSince = (Date.now() - new Date(dateStr).getTime()) / 86_400_000;
  return daysSince <= NEW_THRESHOLD_DAYS;
}

export async function getTenders(): Promise<Tender[]> {
  const { data, error } = await supabase
    .from("tender_opportunities")
    .select("*")
    .order("data_encerramento_proposta", { ascending: true });

  if (error) {
    console.error("Falha ao buscar tender_opportunities:", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    pncpControlNumber: row.pncp_control_number,
    title: row.objeto,
    agency: row.orgao,
    state: row.uf,
    city: row.municipio,
    modality: row.modalidade,
    numeroCompra: row.numero_compra ?? null,
    anoCompra: row.ano_compra ?? null,
    estimatedValue: row.valor_estimado,
    publicationDate: row.data_publicacao,
    deadline: row.data_encerramento_proposta,
    documentUrl: row.link,
    matchedKeywords: row.matched_keywords ?? [],
    isNew: isRecent(row.data_publicacao),
  }));
}
