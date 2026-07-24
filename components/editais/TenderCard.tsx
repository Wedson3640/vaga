import { Building2, ChevronRight } from "lucide-react";
import type { Tender } from "@/types/tender";
import { formatDate, formatProcessNumber } from "@/lib/format";

interface TenderCardProps {
  tender: Tender;
  onOpen: (tender: Tender) => void;
}

export default function TenderCard({ tender, onOpen }: TenderCardProps) {
  const publicationDate = formatDate(tender.publicationDate);
  const processNumber = formatProcessNumber(tender.numeroCompra, tender.anoCompra, tender.pncpControlNumber);

  return (
    <article className="flex min-h-[120px] flex-col gap-3 rounded-lg border border-border bg-bg-item p-4 transition-colors hover:border-emerald/60 sm:flex-row sm:items-center sm:gap-4">
      <div
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-border-soft bg-bg-secondary"
        aria-hidden="true"
      >
        <Building2 className="h-7 w-7 text-emerald" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          {tender.isNew && (
            <span className="rounded bg-emerald px-1.5 py-0.5 text-[10px] font-semibold uppercase text-bg-primary">
              Novo
            </span>
          )}
        </div>
        <h3 className="text-base font-semibold uppercase leading-snug text-text-primary">{tender.title}</h3>
        <p className="mt-1 text-sm text-text-secondary">
          {tender.agency ?? "Órgão não informado"}
          {tender.state ? ` - ${tender.state}` : ""}
        </p>
        <p className="mt-1 text-sm text-text-muted">
          {publicationDate && <span>{publicationDate}</span>}
          {publicationDate && " · "}
          {tender.modality ?? "Modalidade não informada"} {processNumber}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onOpen(tender)}
        className="flex shrink-0 items-center gap-1 self-start rounded-md border border-emerald bg-emerald-dark/30 px-5 py-2 text-sm font-medium text-emerald transition-colors hover:bg-emerald-dark/50 sm:self-center"
      >
        Ver edital
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </article>
  );
}
