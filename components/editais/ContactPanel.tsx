import { Headphones } from "lucide-react";

export default function ContactPanel() {
  return (
    <section className="rounded-lg border border-border bg-bg-card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Headphones className="h-5 w-5 text-emerald" aria-hidden="true" />
        <h2 className="text-base font-bold text-text-primary">Dúvidas?</h2>
      </div>
      <p className="mb-4 text-sm text-text-secondary">Entre em contato conosco para mais informações.</p>
      <button
        type="button"
        className="w-full rounded-md border border-emerald px-4 py-2 text-sm font-medium text-emerald hover:bg-emerald-soft"
      >
        Fale conosco
      </button>
    </section>
  );
}
