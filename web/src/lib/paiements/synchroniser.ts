import type { SupabaseClient } from "@supabase/supabase-js";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import type { CartePaiement } from "@/lib/abonnement/types";
import { liste } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { configurationPaiement } from "./config";
import { lirePaiementPayiz, type PaiementPayiz } from "./payiz";
import { verdictPayiz } from "./regles";

// Appliquer en base ce que dit Payiz d'un paiement. La relecture de l'écran d'attente et les notifications passent
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
      : await supabase.rpc("noter_echec", { p_paiement: paiementId, p_statut: verdict.statut, p_motif: verdict.motif, p_jeton: jeton });
  if (error) throw new Error(error.message || "Le paiement n’a pas pu être enregistré.");
  return versCartePaiement(data);
}

/** Payiz fait expirer une demande au bout de 15 minutes ; au-delà de 24 h, on ne relit plus. */
const FENETRE_RESYNCHRONISATION_MS = 24 * 60 * 60 * 1000;
/** La page attend Payiz 4 secondes au plus : un paiement non relu le sera à la visite suivante. */
const DELAI_RELECTURE_MS = 4000;

/**
 * Avant d'afficher « Mon abonnement » ou la souscription : relit chez Payiz les paiements du compte restés en attente
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
  // En même temps ; une erreur (Payiz injoignable, lent) n'empêche pas les autres : la prochaine visite réessaiera.
  await Promise.allSettled(
    enAttente.map(async (carte) =>
      appliquerPayiz(supabase, carte.id, await lirePaiementPayiz(config.cle, carte.payizId!, fetch, DELAI_RELECTURE_MS), config.jeton),
    ),
  );
}
