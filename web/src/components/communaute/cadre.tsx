import { Banner } from "@/components/ui/Banner";
import { Heading } from "@/components/ui/Text";

/** La migration 0019 n'est pas encore appliquée : on le dit au lieu d'afficher une erreur. */
export function MigrationCommunauteAbsente() {
  return (
    <div className="flex flex-col gap-5">
      <Heading level="page">Communauté</Heading>
      <Banner tone="attention" title="La communauté n’est pas encore dans la base.">
        Appliquez la migration 0019 (guide « Ce qui te revient », section 24).
      </Banner>
    </div>
  );
}
