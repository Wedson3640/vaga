import { FileText, Clock, Search, Download } from "lucide-react";

const BENEFITS = [
  {
    icon: Clock,
    title: "Informações atualizadas",
    description: "Editais publicados semanalmente",
  },
  {
    icon: Search,
    title: "Busca facilitada",
    description: "Encontre oportunidades por estado e data",
  },
  {
    icon: Download,
    title: "Acesso rápido",
    description: "Visualize e acesse os editais completos",
  },
];

export default function AboutPanel() {
  return (
    <section className="rounded-lg border border-border bg-bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5 text-emerald" aria-hidden="true" />
        <h2 className="text-base font-bold text-text-primary">Sobre os editais</h2>
      </div>
      <p className="mb-4 text-sm text-text-secondary">
        Nesta plataforma você encontra licitações públicas de arquitetura e engenharia organizadas por estado.
      </p>
      <ul className="space-y-3">
        {BENEFITS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-text-primary">{title}</p>
              <p className="text-sm text-text-secondary">{description}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
