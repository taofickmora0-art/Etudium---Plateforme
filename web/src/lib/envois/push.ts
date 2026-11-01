import webpush from "web-push";
import type { ConfigPush } from "./config";

// L'envoi d'une notification push vers les appareils d'un compte. Un appareil qui répond 404 ou 410 n'existe plus
// (abonnement expiré, appli désinstallée) : il est rendu pour être retiré. L'envoi est fait si au moins un appareil
// l'a reçu, ou si tous ont disparu (il n'y a plus personne à prévenir).

export type AppareilPush = { adresse: string; p256dh: string; auth: string };
export type ChargePush = { titre: string; texte: string; lien: string };
export type ResultatPush = { ok: boolean; disparus: string[]; erreur?: string };
type Envoi = (
  abonnement: { endpoint: string; keys: { p256dh: string; auth: string } },
  charge: string,
  options: webpush.RequestOptions,
) => Promise<unknown>;

const statut = (e: unknown) => (typeof e === "object" && e !== null && "statusCode" in e ? Number((e as { statusCode: unknown }).statusCode) : null);

export async function envoyerPush(
  config: ConfigPush,
  appareils: AppareilPush[],
  charge: ChargePush,
  envoi: Envoi = webpush.sendNotification,
): Promise<ResultatPush> {
  if (appareils.length === 0) return { ok: true, disparus: [] };
  const options: webpush.RequestOptions = {
    vapidDetails: { subject: config.sujet, publicKey: config.publique, privateKey: config.privee },
    TTL: 24 * 60 * 60,
  };
  const corps = JSON.stringify(charge);
  const resultats = await Promise.allSettled(
    appareils.map(async (a) => envoi({ endpoint: a.adresse, keys: { p256dh: a.p256dh, auth: a.auth } }, corps, options)),
  );
  const disparus: string[] = [];
  let recus = 0;
  let erreur: string | undefined;
  resultats.forEach((r, i) => {
    if (r.status === "fulfilled") recus++;
    else if ([404, 410].includes(statut(r.reason) ?? 0)) disparus.push(appareils[i].adresse);
    else erreur ??= r.reason instanceof Error ? r.reason.message : String(r.reason);
  });
  if (recus > 0 || disparus.length === appareils.length) return { ok: true, disparus };
  return { ok: false, disparus, erreur: erreur ?? "Envoi refusé." };
}
