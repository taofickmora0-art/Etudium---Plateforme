import { createHmac } from "node:crypto";

// Les clés des envois (web/.env.local en local, les variables du site une fois en ligne ; saisies par l'équipe, seule la
// clé publique VAPID porte NEXT_PUBLIC_) :
// - NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUJET : les notifications push (VAPID_SUJET = mailto:… ou https://…) ;
// - RESEND_API_KEY, EMAIL_EXPEDITEUR : les e-mails importants (« Étudium <equipe@domaine> », domaine vérifié chez Resend) ;
// - EMAIL_REPONSE (facultatif) : l'adresse de l'équipe qui reçoit les réponses (un compte suspendu répond à l'e-mail) ;
// - NEXT_PUBLIC_SITE_URL : l'adresse du site, pour les liens absolus des e-mails.
// Le jeton du serveur (ce qui permet à l'appli, et à elle seule, de prendre la file d'envoi) est tiré de la clé Resend,
// à défaut de la clé privée VAPID : rien d'autre à fabriquer, comme pour les paiements (mise en ligne, migration 0071).
// « Activer les envois » au back-office en donne l'empreinte à la base, une fois, et de nouveau quand la clé change.
// ENVOIS_JETON n'est plus lue.

export type ConfigPush = { publique: string; privee: string; sujet: string };
export type ConfigEmail = { cle: string; expediteur: string; reponse?: string | null };
export type ConfigEnvois = { jeton: string; push: ConfigPush | null; email: ConfigEmail | null; site: string };

type Env = Record<string, string | undefined>;

const lire = (env: Env, nom: string) => env[nom]?.trim() || null;

/**
 * Le jeton du serveur : une empreinte (HMAC-SHA256, 64 caractères hexadécimaux) de la clé Resend, à défaut de la clé
 * privée VAPID, qui ne laisse rien voir de la clé ; null sans aucune des deux.
 */
export function jetonEnvois(env: Env = process.env): string | null {
  const cle = lire(env, "RESEND_API_KEY") ?? lire(env, "VAPID_PRIVATE_KEY");
  return cle ? createHmac("sha256", cle).update("etudium:jeton-des-envois").digest("hex") : null;
}

/** La configuration des envois ; null sans le jeton du serveur. Un canal sans toutes ses clés vaut null. */
export function configurationEnvois(env: Env = process.env): ConfigEnvois | null {
  const jeton = jetonEnvois(env);
  if (!jeton) return null;
  const publique = lire(env, "NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privee = lire(env, "VAPID_PRIVATE_KEY");
  const sujet = lire(env, "VAPID_SUJET");
  const cle = lire(env, "RESEND_API_KEY");
  const expediteur = lire(env, "EMAIL_EXPEDITEUR");
  return {
    jeton,
    push: publique && privee && sujet ? { publique, privee, sujet } : null,
    email: cle && expediteur ? { cle, expediteur, reponse: lire(env, "EMAIL_REPONSE") } : null,
    site: (lire(env, "NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),
  };
}
