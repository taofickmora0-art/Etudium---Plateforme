import { Banner } from "@/components/ui/Banner";

/** La migration 0013 n'est pas encore appliquée : on le dit au lieu d'afficher une erreur. */
export function MigrationAbsente() {
  return (
    <Banner tone="attention" title="La page Utilisateurs n’est pas encore dans la base.">
      Appliquez la migration 0013 (guide « Ce qui te revient », section 18).
    </Banner>
  );
}
