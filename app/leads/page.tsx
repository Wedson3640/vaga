import { getLeads } from "@/lib/getLeads";
import LeadsClient from "@/components/leads/LeadsClient";

// A varredura (Edge Function scan-hn-leads) escreve direto no Supabase, sem
// passar pelo Next.js — por isso a página busca dado fresco a cada acesso.
export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getLeads();
  return <LeadsClient leads={leads} />;
}
