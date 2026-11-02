// Le bloc « Envois (e-mails et notifications push) » du back-office (mise en ligne, migration 0071). Ni la clé ni le
// jeton du serveur n'en font partie : l'écran ne reçoit que leur état.

/**
 * actifs : la base reconnaît le jeton du serveur ; a_activer : jamais activé, clé changée (ou migration 0071 absente) ;
 * sans_cle : ni RESEND_API_KEY ni VAPID_PRIVATE_KEY, donc pas de jeton. email et push : le canal a toutes ses clés.
 */
export type EtatEnvois = { etat: "actifs" | "a_activer" | "sans_cle"; email: boolean; push: boolean };

export const SANS_CLE_ENVOIS = "Ajoutez RESEND_API_KEY ou les clés VAPID dans les variables du site, puis redéployez.";
export const MIGRATION_ENVOIS = "Appliquez la migration 0071 (guide « Mise en ligne »).";
