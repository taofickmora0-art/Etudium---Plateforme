import { connection } from "next/server";
import { lireAbonnement, lireFormules, lirePaiements, paiementsOuverts } from "@/lib/abonnement/data";
import { resynchroniserEnAttente } from "@/lib/paiements/synchroniser";
import { PageAbonnement } from "./PageAbonnement";

/**
 * Le contenu serveur de « Mon abonnement ». D'abord, les paiements restés en attente sont relus chez Payiz : un paiement
 * validé après la fermeture de l'onglet s'active ici, même sans notification (en local).
 */
export async function ContenuAbonnement() {
  // À chaque visite : l'état dépend de la date du jour.
  await connection();
  await resynchroniserEnAttente();
  const [abonnement, paiements, formules, ouverts] = await Promise.all([lireAbonnement(), lirePaiements(), lireFormules(), paiementsOuverts()]);
  return <PageAbonnement abonnement={abonnement} paiements={paiements} maintenant={new Date()} formules={formules} ouverts={ouverts} />;
}
