import { Calendar, ChevronDown } from "lucide-react";

export type SortKey = "recent" | "deadline" | "alpha" | "agency";

interface SortSelectProps {
  value: SortKey;
  onChange: (value: SortKey) => void;
}

const OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "recent", label: "Mais recentes" },
  { value: "deadline", label: "Prazo mais próximo" },
  { value: "alpha", label: "Ordem alfabética" },
  { value: "agency", label: "Órgão responsável" },
];

export default function SortSelect({ value, onChange }: SortSelectProps) {
  return (
    <div className="relative">
      <label htmlFor="sort-select" className="sr-only">
        Ordenar por
      </label>
      <Calendar
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
      <select
        id="sort-select"
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="h-[42px] appearance-none rounded-md border border-border bg-bg-secondary py-2 pl-9 pr-9 text-sm text-text-primary focus:border-emerald focus:outline-none"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
