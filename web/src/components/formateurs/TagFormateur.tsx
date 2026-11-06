import { Tag } from "@/components/ui/Tag";
import { estEtudium } from "@/lib/formateurs/etudium";

/** « Formateur », ou le badge « Équipe » pour l'Équipe Étudium (formations sans formateur, 0078). */
export function TagFormateur({ id }: { id: string }) {
  return estEtudium(id) ? <Tag tone="nouveau">Équipe</Tag> : <Tag tone="complementaire">Formateur</Tag>;
}
