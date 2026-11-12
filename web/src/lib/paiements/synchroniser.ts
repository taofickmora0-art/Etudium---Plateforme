import type { SupabaseClient } from "@supabase/supabase-js";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import type { CartePaiement } from "@/lib/abonnement/types";
import { liste } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { configurationPaiement, type ConfigPaiement, type ConfigSasPay } from "./config";
import { lirePaiementPayiz, type PaiementPayiz } from "./payiz";
import { verdictPayiz } from "./regles";
import { estSasPay, motifSasPay, verdictSasPay, verifierSasPay } from "./saspay";

// Appliquer en base ce que dit Payiz (ou SasPay, depuis le 12 novembre 2026) d'un paiement. La relecture de l'écran d'attente et les notifications passent
// toutes deux par ici ; la base (0049) n'active l'abonnement qu'une fois et vérifie le montant.

/**
 * Confirme le paiement ou note son échec, avec le jeton du serveur ; null s'il faut encore attendre. Un paiement Payiz
 * d'une autre référence (ou d'une autre monnaie) n'est jamais appliqué.
 */
export async function appliquerPayiz(supabase: SupabaseClient, paiementId: string, p: PaiementPayiz, jeton: string): Promise<CartePaiement | null> {
  if (p.reference !== paiementId || p.currency !== "XOF") throw new Error("Paiement Payiz étranger.");
  const verdict = verdictPayiz(p);
  if (verdict.action === "attendre") return null;
  const { data, error } =
    verdict.action === "confirmer"
      ? await supabase.rpc("confirmer_paiement", { p_paiement: paiementId, p_payiz: p.id, p_montant: verdict.montant, p_jeton: jeton })
      : await supabase.rpc("noter_echec", { p_paiement: paiementId, p_statut: verdict.statut, p_motif: verdict.motif, p_jeton: jeton, p_payiz: p.id });
  if (error) throw new Error(error.message || "Le paiement n’a pas pu être enregistré.");
  return versCartePaiement(data);
}

/**
 * Relit un paiement chez SasPay (12 novembre 2026) et l'applique en base : confirmé, échoué (avec son motif), ou null
 * s'il faut encore attendre. La base compare le montant et la référence (« softpay:… ») à ceux qu'elle a notés.
 */
export async function appliquerSasPay(
  supabase: SupabaseClient,
  paiement: { id: string; montant: number; ref: string },
  saspay: ConfigSasPay,
  jeton: string,
  delaiMs?: number,
): Promise<CartePaiement | null> {
  const verdict = verdictSasPay(await verifierSasPay(saspay.cle, paiement.ref, fetch, delaiMs), paiement.montant);
  if (verdict.action === "attendre") return null;
  const { data, error } =
    verdict.action === "confirmer"
      ? await supabase.rpc("confirmer_paiement", { p_paiement: paiement.id, p_payiz: paiement.ref, p_montant: verdict.montant, p_jeton: jeton })
      : await supabase.rpc("noter_echec", { p_paiement: paiement.id, p_statut: verdict.statut, p_motif: await motifSasPay(saspay.cle, paiement.ref, fetch, delaiMs), p_jeton: jeton, p_payiz: paiement.ref });
  if (error) throw new Error(error.message || "Le paiement n’a pas pu être enregistré.");
  return versCartePaiement(data);
}

/** Relit un paiement envoyé chez le prestataire qui l'encaisse (d'après sa référence) ; null s'il faut encore attendre. */
export async function relirePaiement(supabase: SupabaseClient, config: ConfigPaiement, carte: CartePaiement, delaiMs?: number): Promise<CartePaiement | null> {
  if (!carte.payizId) return null;
  if (estSasPay(carte.payizId)) {
    // Clé de SasPay retirée entre-temps : l'état reste celui connu.
    return config.saspay ? appliquerSasPay(supabase, { id: carte.id, montant: carte.montant, ref: carte.payizId }, config.saspay, config.jeton, delaiMs) : null;
  }
  return appliquerPayiz(supabase, carte.id, await lirePaiementPayiz(config.cle, carte.payizId, fetch, delaiMs), config.jeton);
}

/** Payiz fait expirer une demande au bout de 15 minutes ; au-delà de 24 h, on ne relit plus. */
const FENETRE_RESYNCHRONISATION_MS = 24 * 60 * 60 * 1000;
/** La page attend Payiz 4 secondes au plus : un paiement non relu le sera à la visite suivante. */
const DELAI_RELECTURE_MS = 4000;

/**
 * Avant d'afficher « Mon abonnement » ou la souscription : relit chez Payiz (ou SasPay) les paiements du compte restés en attente
 * depuis moins de 24 h (onglet fermé pendant l'attente ; en local, Payiz ne peut pas notifier). Une erreur n'empêche
 * pas l'affichage.
 */
export async function resynchroniserEnAttente(): Promise<void> {
  const config = configurationPaiement();
  if (!config) return;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mes_paiements");
  if (error) return;
  const limite = Date.now() - FENETRE_RESYNCHRONISATION_MS;
  const enAttente = liste(data)
    .map(versCartePaiement)
    .filter((c) => c.statut === "en_attente" && c.payizId && c.essaiLe && Date.parse(c.essaiLe) > limite);
  // En même temps ; une erreur (Payiz ou SasPay injoignable, lent) n'empêche pas les autres : la prochaine visite réessaiera.
  await Promise.allSettled(enAttente.map((carte) => relirePaiement(supabase, config, carte, DELAI_RELECTURE_MS)));
}
