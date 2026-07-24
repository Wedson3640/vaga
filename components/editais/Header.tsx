import { Building2, Search } from "lucide-react";

interface HeaderProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
}

const NAV_ITEMS: Array<{ label: string; href: string; active?: boolean }> = [
  { label: "Buscar Vagas", href: "/" },
  { label: "Editais de Arquitetura", href: "/editais", active: true },
  { label: "Leads Dev", href: "/leads" },
];

export default function Header({ searchValue, onSearchChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-primary/95 px-4 py-3 backdrop-blur sm:px-8 sm:py-0 sm:h-[76px] lg:px-16">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 shrink-0 text-emerald" aria-hidden="true" />
        <div>
          <p className="text-lg font-bold leading-tight text-text-primary">Editais de Arquitetura</p>
          <p className="text-sm leading-tight text-text-secondary">Licitações públicas</p>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="hidden items-center gap-8 md:flex">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={
              item.active
                ? "border-b-2 border-emerald pb-1 text-sm font-medium text-emerald"
                : "pb-1 text-sm font-medium text-text-secondary hover:text-text-primary"
            }
          >
            {item.label}
          </a>
        ))}
      </nav>

      <div className="relative order-3 w-full shrink-0 sm:order-none sm:w-[275px]">
        <label htmlFor="tender-search" className="sr-only">
          Buscar editais
        </label>
        <input
          id="tender-search"
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar editais..."
          className="h-[42px] w-full rounded-md border border-border bg-transparent px-3 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:border-emerald focus:outline-none"
        />
        <Search
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          aria-hidden="true"
        />
      </div>
    </header>
  );
}
