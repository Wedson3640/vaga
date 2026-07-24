import { getTenders } from "@/lib/getTenders";
import EditaisClient from "@/components/editais/EditaisClient";

// A varredura semanal (Edge Function scan-tenders) escreve direto no Supabase,
// sem passar pelo Next.js — por isso a página precisa buscar dado fresco a
// cada acesso em vez de usar o cache padrão de build do App Router.
export const dynamic = "force-dynamic";

export default async function EditaisPage() {
  const tenders = await getTenders();
  return <EditaisClient tenders={tenders} />;
}
