"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { DevLead } from "@/types/lead";
import SiteNav from "@/components/SiteNav";
import LeadCard from "./LeadCard";

export default function LeadsClient({ leads }: { leads: DevLead[] }) {
  const [search, setSearch] = useState("");

  const visibleLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return leads;
    return leads.filter(
      (l) => l.snippet.toLowerCase().includes(term) || (l.author ?? "").toLowerCase().includes(term),
    );
  }, [leads, search]);

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="border-b border-border px-4 py-4 sm:px-8 lg:px-16">
        <SiteNav active="leads" />
      </header>

      <main className="mx-auto max-w-[1340px] px-4 py-8 sm:px-8 lg:px-16">
        <h1 className="text-2xl font-bold text-text-primary sm:text-3xl">Leads de Desenvolvimento</h1>
        <p className="mt-1 text-text-secondary">
          Vagas de contrato/freelance encontradas na thread mensal &quot;Who is hiring?&quot; do Hacker News.
        </p>

        <div className="relative mt-6 max-w-md">
          <label htmlFor="lead-search" className="sr-only">
            Buscar leads
          </label>
          <input
            id="lead-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por texto ou autor..."
            className="h-[42px] w-full rounded-md border border-border bg-bg-secondary px-3 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:outline-none"
          />
          <Search
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
            aria-hidden="true"
          />
        </div>

        <p className="mt-4 text-sm text-text-secondary">
          {visibleLeads.length} {visibleLeads.length === 1 ? "lead encontrado" : "leads encontrados"}
        </p>

        <ul className="mt-4 space-y-3">
          {visibleLeads.length === 0 && (
            <li className="py-8 text-center text-sm text-text-secondary">
              Nenhum lead encontrado para esse filtro.
            </li>
          )}
          {visibleLeads.map((lead) => (
            <li key={lead.id}>
              <LeadCard lead={lead} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
