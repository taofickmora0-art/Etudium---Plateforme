import { configurationPaiement } from "@/lib/paiements/config";
import { lirePaiementPayiz } from "@/lib/paiements/payiz";
import { verifierSignature } from "@/lib/paiements/signature";
import { appliquerPayiz } from "@/lib/paiements/synchroniser";
import { createClient } from "@/lib/supabase/server";

// Les notifications de Payiz (lot 2, spec §3) : payment.succeeded, payment.attempt_failed, payment.expired,
// payment.canceled. Elles activent l'abonnement même si l'étudiant a fermé la page. La signature est vérifiée sur le
// corps brut avant toute lecture ; l'état du paiement est relu chez Payiz (les notifications peuvent arriver dans le
// désordre) puis appliqué en base avec le jeton du serveur. Sans réponse 2xx, Payiz relance : une erreur passagère
// répond 500 et la notification n'est notée traitée qu'une fois traitée. Pas de session ici : les fonctions appelées
// sont gardées par le jeton.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reponse = (status: number, corps: unknown) => Response.json(corps, { status });
const RECU = { recu: true };

type Evenement = { id?: unknown; type?: unknown; data?: { object?: { id?: unknown } } };

export async function POST(request: Request): Promise<Response> {
  const config = configurationPaiement();
  if (!config?.secretWebhook) return reponse(503, { erreur: "Notifications non configurées." });

  const corps = await request.text();
  if (!verifierSignature(corps, request.headers.get("payiz-signature"), config.secretWebhook)) {
    return reponse(400, { erreur: "Signature refusée." });
  }
  let evenement: Evenement;
  try {
    evenement = JSON.parse(corps) as Evenement;
  } catch {
    return reponse(400, { erreur: "Notification illisible." });
  }
  if (typeof evenement.id !== "string" || typeof evenement.type !== "string") return reponse(400, { erreur: "Notification illisible." });
  // Remboursements, retraits, litiges… : rien à faire ici.
  const payizId = evenement.data?.object?.id;
  if (!evenement.type.startsWith("payment.") || typeof payizId !== "string") return reponse(200, RECU);

  const supabase = await createClient();
  const { data: dejaTraitee, error } = await supabase.rpc("evenement_payiz_traite", { p_id: evenement.id, p_jeton: config.jeton });
  if (error) return reponse(500, { erreur: "Traitement impossible." });
  if (dejaTraitee === true) return reponse(200, RECU);

  try {
    const paiement = await lirePaiementPayiz(config.cle, payizId);
    // Un paiement d'ailleurs (même compte Payiz, autre référence) ne nous regarde pas.
    if (!paiement.reference || !UUID.test(paiement.reference)) return reponse(200, RECU);
    await appliquerPayiz(supabase, paiement.reference, paiement, config.jeton);
  } catch (e) {
    if (e instanceof Error && e.message === "Paiement Payiz étranger.") return reponse(200, RECU);
    return reponse(500, { erreur: "Traitement impossible." });
  }
  await supabase.rpc("evenement_payiz", { p_id: evenement.id, p_jeton: config.jeton });
  return reponse(200, RECU);
}
