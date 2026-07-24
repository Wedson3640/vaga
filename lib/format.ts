export function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

export function formatCurrency(value: number | null): string {
  if (value == null) return "Valor não informado";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatProcessNumber(
  numeroCompra: string | null,
  anoCompra: number | null,
  pncpControlNumber: string,
): string {
  if (numeroCompra) {
    return anoCompra ? `nº ${numeroCompra}/${anoCompra}` : `nº ${numeroCompra}`;
  }
  return `PNCP ${pncpControlNumber}`;
}
