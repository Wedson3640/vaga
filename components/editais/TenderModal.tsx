"use client";

import { useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import type { Tender } from "@/types/tender";
import { formatCurrency, formatDate, formatProcessNumber } from "@/lib/format";

interface TenderModalProps {
  tender: Tender | null;
  onClose: () => void;
}

export default function TenderModal({ tender, onClose }: TenderModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tender) return;

    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [tender, onClose]);

  if (!tender) return null;

  const processNumber = formatProcessNumber(tender.numeroCompra, tender.anoCompra, tender.pncpControlNumber);
  const publicationDate = formatDate(tender.publicationDate);
  const deadline = formatDate(tender.deadline);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tender-modal-title"
        className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-bg-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id="tender-modal-title" className="text-xl font-bold text-text-primary">
            {tender.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 rounded-md border border-border p-1.5 text-text-secondary hover:border-emerald hover:text-emerald"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-text-muted">Órgão responsável</dt>
            <dd className="text-text-primary">{tender.agency ?? "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Estado / Cidade</dt>
            <dd className="text-text-primary">
              {tender.city ?? "Não informado"} {tender.state ? `- ${tender.state}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-text-muted">Modalidade</dt>
            <dd className="text-text-primary">{tender.modality ?? "Não informada"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Número do processo</dt>
            <dd className="text-text-primary">{processNumber}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Data de publicação</dt>
            <dd className="text-text-primary">{publicationDate ?? "Não informada"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Prazo final de propostas</dt>
            <dd className="text-text-primary">{deadline ?? "Não informado"}</dd>
          </div>
          <div>
            <dt className="text-text-muted">Valor estimado</dt>
            <dd className="text-text-primary">{formatCurrency(tender.estimatedValue)}</dd>
          </div>
        </dl>

        <div className="mt-4">
          <dt className="text-sm text-text-muted">Descrição completa</dt>
          <dd className="mt-1 text-sm leading-relaxed text-text-secondary">{tender.title}</dd>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {tender.documentUrl && (
            <a
              href={tender.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-emerald bg-emerald-dark/30 px-5 py-2 text-sm font-medium text-emerald hover:bg-emerald-dark/50"
            >
              Acessar edital
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-5 py-2 text-sm font-medium text-text-secondary hover:border-text-muted hover:text-text-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
