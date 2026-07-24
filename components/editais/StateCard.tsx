import { Building2, ChevronRight } from "lucide-react";

interface StateCardProps {
  name: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}

export default function StateCard({ name, count, selected, onSelect }: StateCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Filtrar por ${name}`}
      className={
        "flex h-[100px] items-center justify-between gap-3 rounded-lg border px-4 text-left transition-colors " +
        (selected
          ? "border-emerald bg-emerald-soft"
          : "border-border bg-bg-card hover:border-text-muted")
      }
    >
      <div className="flex items-center gap-3">
        <Building2
          className={"h-9 w-9 shrink-0 " + (selected ? "text-emerald" : "text-text-muted")}
          aria-hidden="true"
        />
        <div>
          <p className={"font-bold " + (selected ? "text-emerald" : "text-text-primary")}>{name}</p>
          <p className="text-sm text-text-secondary">
            {count} {count === 1 ? "licitação" : "licitações"}
          </p>
        </div>
      </div>
      <ChevronRight
        className={"h-5 w-5 shrink-0 " + (selected ? "text-emerald" : "text-text-muted")}
        aria-hidden="true"
      />
    </button>
  );
}
