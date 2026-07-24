import { ExternalLink } from "lucide-react";
import type { DevLead } from "@/types/lead";

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(new Date(value));
}

export default function LeadCard({ lead }: { lead: DevLead }) {
  const posted = formatDate(lead.postedAt);

  return (
    <article className="rounded-lg border border-border bg-bg-item p-4 transition-colors hover:border-emerald/60">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text-primary">{lead.author ?? "Autor não informado"}</p>
        {posted && <span className="text-xs text-text-muted">{posted}</span>}
      </div>

      <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">{lead.snippet}</p>

      {lead.matchedKeywords.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lead.matchedKeywords.map((kw) => (
            <span key={kw} className="rounded-full border border-border bg-bg-card px-2.5 py-0.5 text-xs text-text-muted">
              {kw}
            </span>
          ))}
        </div>
      )}

      <a
        href={lead.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-sm text-emerald hover:underline"
      >
        Ver no Hacker News
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </article>
  );
}
