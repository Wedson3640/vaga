import type { Tender } from "@/types/tender";
import TenderCard from "./TenderCard";

interface TenderListProps {
  tenders: Tender[];
  onOpen: (tender: Tender) => void;
}

export default function TenderList({ tenders, onOpen }: TenderListProps) {
  if (tenders.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-secondary">
        Nenhuma licitação encontrada para esse filtro.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {tenders.map((tender) => (
        <li key={tender.id}>
          <TenderCard tender={tender} onOpen={onOpen} />
        </li>
      ))}
    </ul>
  );
}
