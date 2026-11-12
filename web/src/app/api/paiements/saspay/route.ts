import { configurationPaiement } from "@/lib/paiements/config";
import { viderFileApres } from "@/lib/envois/declencher";
import { verifierSignatureSasPay } from "@/lib/paiements/saspay";
import { appliquerSasPay } from "@/lib/paiements/synchroniser";
import { createClient } from "@/lib/supabase/server";

// Les notifications de SasPay (12 novembre 2026, prestataire de secours de Payiz) : transaction.success, .failed…
// Elles activent l'abonnement même si l'étudiant a fermé la page. La signature (HMAC-SHA256 de « horodatage.corps brut »)
// est vérifiée avant toute lecture. Elles ne nomment pas notre paiement : elles déclenchent la relecture, chez SasPay,
// des paiements SasPay en attente depuis moins de 24 h (0081), appliquée en base avec le jeton du serveur. Une relecture
// est sans danger si elle se répète (la base n'active un abonnement qu'une fois). Sans réponse 2xx, SasPay relance.

const reponse = (status: number, corps: unknown) => Response.json(corps, { status });
const RECU = { recu: true };
/** Quelques secondes par paiement au plus : SasPay attend 15 secondes la réponse. */
const DELAI_RELECTURE_MS = 4000;

type EnAttente = { id: string; ref: string; montant: number };

/** Refus de la base qui ne changeront pas à la relance (montant ou référence différents) : rien à réessayer. */
const REFUS_DEFINITIFS = new Set(["Paiement inconnu.", "Paiement Payiz différent.", "Montant différent du paiement enregistré."]);

export async function POST(request: Request): Promise<Response> {
  const config = configurationPaiement();
  const saspay = config?.saspay;
  if (!config || !saspay?.secretWebhook) return reponse(503, { erreur: "Notifications non configurées." });

  const corps = await request.text();
  if (!verifierSignatureSasPay(corps, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"), saspay.secretWebhook)) {
    return reponse(403, { erreur: "Signature refusée." });
  }
  let evenement: { event?: unknown };
  try {
    evenement = JSON.parse(corps) as { event?: unknown };
  } catch {
    return reponse(400, { erreur: "Notification illisible." });
  }
  // Retraits, transferts, test : rien à faire ici.
  if (typeof evenement.event !== "string" || !evenement.event.startsWith("transaction.")) return reponse(200, RECU);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("paiements_softpay_en_attente", { p_jeton: config.jeton });
  if (error) return reponse(500, { erreur: "Traitement impossible." });
  const enAttente = (Array.isArray(data) ? data : []).filter(
    (p): p is EnAttente => typeof p?.id === "string" && typeof p?.ref === "string" && typeof p?.montant === "number",
  );
  const cartes = await Promise.allSettled(enAttente.map((p) => appliquerSasPay(supabase, p, saspay, config.jeton, DELAI_RELECTURE_MS)));
  // Le reçu par e-mail (migration 0058) part tout de suite.
  if (cartes.some((c) => c.status === "fulfilled" && c.value?.statut === "reussi")) viderFileApres();
  // Une relecture en échec (SasPay lent ou injoignable) : 500, pour que SasPay relance et qu'elle soit refaite.
  const aRefaire = cartes.some((c) => c.status === "rejected" && !(c.reason instanceof Error && REFUS_DEFINITIFS.has(c.reason.message)));
  return aRefaire ? reponse(500, { erreur: "Relecture à refaire." }) : reponse(200, RECU);
}
