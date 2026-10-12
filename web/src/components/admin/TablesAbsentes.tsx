import { Banner } from "@/components/ui/Banner";
import { estTablesAbsentes } from "@/lib/admin/data";

/** Les tables du lot 1 ne sont pas encore dans la base : on le dit au lieu d'afficher une erreur. */
export function TablesAbsentes() {
  return (
    <Banner tone="attention" title="Les tables du lot 1 ne sont pas encore dans la base.">
      Appliquez la migration 0004, puis la 0005 (guide « Ce qui te revient », section 5).
    </Banner>
  );
}

/** Rend `TablesAbsentes` pour cette erreur-là ; relance toute autre erreur (écran « Une erreur est survenue »). */
export function siTablesAbsentes(erreur: unknown) {
  if (estTablesAbsentes(erreur)) return <TablesAbsentes />;
  throw erreur;
}
