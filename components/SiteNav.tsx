type NavKey = "vagas" | "editais" | "leads";

const ITEMS: Array<{ key: NavKey; label: string; href: string }> = [
  { key: "vagas", label: "Buscar Vagas", href: "/" },
  { key: "editais", label: "Editais de Arquitetura", href: "/editais" },
  { key: "leads", label: "Leads Dev", href: "/leads" },
];

export default function SiteNav({ active }: { active: NavKey }) {
  return (
    <nav className="flex flex-wrap gap-2">
      {ITEMS.map((item) => (
        <a
          key={item.key}
          href={item.href}
          aria-current={item.key === active ? "page" : undefined}
          className={
            "rounded-full border px-3.5 py-1.5 text-sm " +
            (item.key === active
              ? "border-[#5eead4] bg-[#2dd4bf1a] text-[#5eead4]"
              : "border-[#2a3742] text-[#8b98a5] hover:text-[#e6edf3]")
          }
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
