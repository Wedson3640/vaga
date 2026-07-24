"use client";

import { useMemo, useState } from "react";
import type { Tender } from "@/types/tender";
import Header from "./Header";
import StateCard from "./StateCard";
import SortSelect, { type SortKey } from "./SortSelect";
import TenderList from "./TenderList";
import TenderModal from "./TenderModal";
import AboutPanel from "./AboutPanel";
import ContactPanel from "./ContactPanel";

const STATES: Array<{ code: string; name: string }> = [
  { code: "PI", name: "Piauí" },
  { code: "MA", name: "Maranhão" },
  { code: "CE", name: "Ceará" },
  { code: "PA", name: "Pará" },
];

function sortTenders(tenders: Tender[], sortKey: SortKey): Tender[] {
  const sorted = [...tenders];
  switch (sortKey) {
    case "recent":
      return sorted.sort((a, b) => (b.publicationDate ?? "").localeCompare(a.publicationDate ?? ""));
    case "deadline":
      return sorted.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
    case "alpha":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    case "agency":
      return sorted.sort((a, b) => (a.agency ?? "").localeCompare(b.agency ?? ""));
    default:
      return sorted;
  }
}

export default function EditaisClient({ tenders }: { tenders: Tender[] }) {
  const [selectedState, setSelectedState] = useState(STATES[0].code);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [modalTender, setModalTender] = useState<Tender | null>(null);

  const countsByState = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tender of tenders) {
      if (!tender.state) continue;
      counts[tender.state] = (counts[tender.state] ?? 0) + 1;
    }
    return counts;
  }, [tenders]);

  const visibleTenders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const byState = tenders.filter((t) => t.state === selectedState);
    const bySearch = term
      ? byState.filter(
          (t) => t.title.toLowerCase().includes(term) || (t.agency ?? "").toLowerCase().includes(term),
        )
      : byState;
    return sortTenders(bySearch, sortKey);
  }, [tenders, selectedState, search, sortKey]);

  const selectedStateName = STATES.find((s) => s.code === selectedState)?.name ?? selectedState;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header searchValue={search} onSearchChange={setSearch} />

      <main className="mx-auto max-w-[1340px] px-4 py-8 sm:px-8 lg:px-16">
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Licitações por Estado</h1>
        <p className="mt-1 text-text-secondary">
          Confira as licitações públicas de arquitetura e engenharia nos estados selecionados.
        </p>

        <section aria-label="Selecionar estado" className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STATES.map((state) => (
            <StateCard
              key={state.code}
              name={state.name}
              count={countsByState[state.code] ?? 0}
              selected={selectedState === state.code}
              onSelect={() => setSelectedState(state.code)}
            />
          ))}
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-4">
          <section className="rounded-lg border border-border bg-bg-card p-4 sm:p-5 lg:col-span-3">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-emerald">{selectedStateName}</p>
                <p className="text-sm text-text-secondary">
                  {visibleTenders.length} {visibleTenders.length === 1 ? "licitação encontrada" : "licitações encontradas"}
                </p>
              </div>
              <SortSelect value={sortKey} onChange={setSortKey} />
            </div>

            <TenderList tenders={visibleTenders} onOpen={setModalTender} />
          </section>

          <aside className="space-y-6 lg:col-span-1">
            <AboutPanel />
            <ContactPanel />
          </aside>
        </div>
      </main>

      <TenderModal tender={modalTender} onClose={() => setModalTender(null)} />
    </div>
  );
}
