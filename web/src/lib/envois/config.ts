// Les clés des envois (web/.env.local, saisies par l'équipe ; seule la clé publique VAPID porte NEXT_PUBLIC_) :
// - ENVOIS_JETON : le jeton du serveur, affiché une fois à la fin de la migration 0058 (la base n'en garde que l'empreinte) ;
// - NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUJET : les notifications push (VAPID_SUJET = mailto:… ou https://…) ;
// - RESEND_API_KEY, EMAIL_EXPEDITEUR : les e-mails importants (« Étudium <equipe@domaine> », domaine vérifié chez Resend) ;
// - NEXT_PUBLIC_SITE_URL : l'adresse du site, pour les liens absolus des e-mails.

export type ConfigPush = { publique: string; privee: string; sujet: string };
export type ConfigEmail = { cle: string; expediteur: string };
export type ConfigEnvois = { jeton: string; push: ConfigPush | null; email: ConfigEmail | null; site: string };

const lire = (env: Record<string, string | undefined>, nom: string) => env[nom]?.trim() || null;

/** La configuration des envois ; null sans le jeton du serveur. Un canal sans toutes ses clés vaut null. */
export function configurationEnvois(env: Record<string, string | undefined> = process.env): ConfigEnvois | null {
  const jeton = lire(env, "ENVOIS_JETON");
  if (!jeton || jeton.length !== 64) return null;
  const publique = lire(env, "NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const privee = lire(env, "VAPID_PRIVATE_KEY");
  const sujet = lire(env, "VAPID_SUJET");
  const cle = lire(env, "RESEND_API_KEY");
  const expediteur = lire(env, "EMAIL_EXPEDITEUR");
  return {
    jeton,
    push: publique && privee && sujet ? { publique, privee, sujet } : null,
    email: cle && expediteur ? { cle, expediteur } : null,
    site: (lire(env, "NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000").replace(/\/+$/, ""),
  };
}
