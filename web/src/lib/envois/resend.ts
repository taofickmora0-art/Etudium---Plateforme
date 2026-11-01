import type { ConfigEmail } from "./config";

// L'envoi d'un e-mail par l'API de Resend. La clé d'idempotence (une par envoi de la file) évite un doublon quand un
// envoi est repris après une réponse perdue : Resend la garde 24 heures, la durée de vie d'un envoi dans la file.

export type MessageEmail = { a: string; sujet: string; html: string; texte: string; idempotence?: string };
export type ResultatEmail = { ok: true } | { ok: false; erreur: string };

const ADRESSE_RESEND = "https://api.resend.com/emails";

export async function envoyerEmail(config: ConfigEmail, m: MessageEmail, f: typeof fetch = fetch): Promise<ResultatEmail> {
  try {
    const reponse = await f(ADRESSE_RESEND, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.cle}`,
        "Content-Type": "application/json",
        ...(m.idempotence ? { "Idempotency-Key": m.idempotence } : {}),
      },
      body: JSON.stringify({
        from: config.expediteur,
        to: [m.a],
        subject: m.sujet,
        html: m.html,
        text: m.texte,
        ...(config.reponse ? { reply_to: config.reponse } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (reponse.ok) return { ok: true };
    const corps = (await reponse.json().catch(() => null)) as { message?: unknown } | null;
    const detail = typeof corps?.message === "string" ? corps.message : reponse.statusText || "réponse inattendue";
    return { ok: false, erreur: `Resend ${reponse.status} : ${detail}` };
  } catch (e) {
    return { ok: false, erreur: e instanceof Error ? e.message : String(e) };
  }
}
