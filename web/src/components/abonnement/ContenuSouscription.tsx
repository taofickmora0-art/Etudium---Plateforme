import { lireAbonnement, lireFormules, paiementsOuverts } from "@/lib/abonnement/data";
import type { CodeFormule } from "@/lib/abonnement/types";
import { moyensParMontant } from "@/lib/paiements/moyens";
import { resynchroniserEnAttente } from "@/lib/paiements/synchroniser";
import { Souscription } from "./Souscription";

const CODES: CodeFormule[] = ["basique", "standard", "premium"];

/**
 * Le contenu serveur de la souscription. D'abord, les paiements restés en attente sont relus chez Payiz : un paiement
 * réussi pendant l'absence de l'étudiant s'active, au lieu d'être payé une seconde fois. Puis les moyens de paiement de
 * Payiz pour chaque prix (gardés 5 minutes), si les paiements sont ouverts.
 */
export async function ContenuSouscription({ formule }: { formule: string | string[] | undefined }) {
  await resynchroniserEnAttente();
  const [formules, abonnement, ouverts] = await Promise.all([lireFormules(), lireAbonnement(), paiementsOuverts()]);
  const initiale = CODES.find((c) => c === formule) ?? null;
  const moyens = ouverts ? await moyensParMontant(formules.filter((f) => f.active).map((f) => f.prix)) : {};
  return (
    <Souscription formules={formules} abonnement={abonnement} ouverts={ouverts} initiale={initiale} maintenant={new Date().toISOString()} moyens={moyens} />
  );
}
