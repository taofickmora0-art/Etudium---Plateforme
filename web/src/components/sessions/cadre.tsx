import { RACINE_FORMATEUR } from "@/components/formateur/cadre";
import { Banner } from "@/components/ui/Banner";
import type { EspaceEdition } from "@/lib/admin/espace";

// Pièces communes des pages « Sessions live » de l'espace formateur et du back-office (spec des sessions live, §4).

export const baseSessions = (espace: EspaceEdition) => (espace === "formateur" ? "/formateur/sessions" : "/admin/sessions");

/** Début du fil d'Ariane : l'espace formateur, sinon le back-office (celui de PageAdmin). */
export const racineSessions = (espace: EspaceEdition) => (espace === "formateur" ? RACINE_FORMATEUR : undefined);

export const filSessions = (espace: EspaceEdition) => ({ label: "Sessions live", href: baseSessions(espace) });

/** La migration 0018 n'est pas encore appliquée : on le dit au lieu d'afficher une erreur. */
export function MigrationSessionsAbsente() {
  return (
    <Banner tone="attention" title="Les sessions live ne sont pas encore dans la base.">
      Appliquez la migration 0018 (guide « Ce qui te revient », section 23).
    </Banner>
  );
}
