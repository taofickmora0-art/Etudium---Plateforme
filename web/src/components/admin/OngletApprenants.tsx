import { Banner } from "@/components/ui/Banner";
import { lireApprenants, MIGRATION_APPRENANTS } from "@/lib/formateur/apprenants";
import { ListeApprenants } from "./ListeApprenants";

/**
 * L'onglet « Apprenants » de l'éditeur d'une formation (refonte des formations, étape C), au back-office et dans
 * l'espace formateur : la première page, lue sur le serveur ; avant la 0029, le bandeau de la migration.
 */
export async function OngletApprenants({ formationId, espace }: { formationId: string; espace: "admin" | "formateur" }) {
  const lu = await lireApprenants(formationId);
  if (lu.migrationAbsente) return <Banner tone="information" title={MIGRATION_APPRENANTS} />;
  return <ListeApprenants formationId={formationId} espace={espace} initial={lu.donnees} />;
}
