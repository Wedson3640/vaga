export type UF = "PI" | "MA" | "CE" | "PA";

export interface Tender {
  id: string;
  pncpControlNumber: string;
  title: string;
  agency: string | null;
  state: UF | string | null;
  city: string | null;
  modality: string | null;
  numeroCompra: string | null;
  anoCompra: number | null;
  estimatedValue: number | null;
  publicationDate: string | null;
  deadline: string | null;
  documentUrl: string | null;
  matchedKeywords: string[];
  isNew: boolean;
}
