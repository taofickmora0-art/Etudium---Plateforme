import { Banner } from "@/components/ui/Banner";
import { MIGRATION_BIBLIOTHEQUE } from "@/lib/bibliotheque/regles";

/** Le back-office sans la 0074 : la migration à appliquer (pages de l'équipe seulement). */
export function BibliothequeAbsente() {
  return (
    <Banner tone="attention" title="La Bibliothèque n’est pas encore dans la base">
      {MIGRATION_BIBLIOTHEQUE}
    </Banner>
  );
}
