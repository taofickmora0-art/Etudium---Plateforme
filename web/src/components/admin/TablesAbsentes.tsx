import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { estTablesAbsentes } from "@/lib/admin/data";

/**
 * Les tables des formations ne sont pas encore dans la base : on le dit au lieu d'afficher une erreur. L'équipe lit la
 * migration à appliquer ; un étudiant, un formateur ou un visiteur, un message neutre.
 */
export function TablesAbsentes({ equipe = false }: { equipe?: boolean }) {
  if (!equipe) return <BandeauIndisponible />;
  return (
    <Banner tone="attention" title="Les tables des formations ne sont pas encore dans la base.">
      Appliquez la migration 0004, puis la 0005 (guide « Ce qui te revient », section 5).
    </Banner>
  );
}

/**
 * Rend `TablesAbsentes` pour cette erreur-là (`equipe` : une page du back-office) ; relance toute autre erreur (écran
 * « Une erreur est survenue »).
 */
export function siTablesAbsentes(erreur: unknown, { equipe = false }: { equipe?: boolean } = {}) {
  if (estTablesAbsentes(erreur)) return <TablesAbsentes equipe={equipe} />;
  throw erreur;
}
