import type { SupabaseClient } from "@supabase/supabase-js";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import type { CartePaiement } from "@/lib/abonnement/types";
import type { PaiementPayiz } from "./payiz";
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
