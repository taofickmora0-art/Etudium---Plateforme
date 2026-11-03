import { Banner } from "@/components/ui/Banner";
import { BandeauIndisponible } from "@/components/ui/BandeauIndisponible";
import { lireApprenants, MIGRATION_APPRENANTS } from "@/lib/formateur/apprenants";
import { ListeApprenants } from "./ListeApprenants";

/**
 * L'onglet « Apprenants » de l'éditeur d'une formation (refonte des formations, étape C), au back-office et dans
 * l'espace formateur : la première page, lue sur le serveur ; avant la 0029, le bandeau de la migration (neutre pour le formateur). Une erreur de
 * lecture reste dans l'onglet : l'écran d'erreur remplacerait tout l'éditeur, et les saisies des autres onglets.
 */
export async function OngletApprenants({ formationId, espace }: { formationId: string; espace: "admin" | "formateur" }) {
  let lu: Awaited<ReturnType<typeof lireApprenants>>;
  try {
    lu = await lireApprenants(formationId);
  } catch {
    return <Banner tone="erreur" title="Les apprenants n’ont pas pu être chargés. Rechargez la page pour réessayer." />;
  }
  if (lu.migrationAbsente) return espace === "admin" ? <Banner tone="information" title={MIGRATION_APPRENANTS} /> : <BandeauIndisponible />;
  return <ListeApprenants formationId={formationId} espace={espace} initial={lu.donnees} />;
}
