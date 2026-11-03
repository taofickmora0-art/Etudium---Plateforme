import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { Heading } from "@/components/ui/Text";

/** La migration 0019 n'est pas encore appliquée : un message neutre au lieu d'une erreur (étudiants et formateurs). */
export function MigrationCommunauteAbsente() {
  return (
    <div className="flex flex-col gap-5">
      <Heading level="page">Communauté</Heading>
      <BandeauIndisponible />
    </div>
  );
}
