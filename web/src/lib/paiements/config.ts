// Les secrets du paiement (web/.env.local, saisis par l'équipe ; jamais de préfixe NEXT_PUBLIC_) :
// - PAYIZ_CLE_SECRETE : la clé secrète Payiz (sk_test_… en test, sk_live_… en réel) ;
// - PAIEMENT_JETON : le jeton du serveur, dont la base garde l'empreinte (« Activer les paiements ») ;
// - PAYIZ_SECRET_WEBHOOK : le secret des notifications signées, une fois le site en ligne.

export type ConfigPaiement = { cle: string; jeton: string; secretWebhook: string | null; mode: "test" | "reel" };

/** La configuration du paiement ; null s'il manque la clé Payiz ou le jeton du serveur. */
export function configurationPaiement(env: Record<string, string | undefined> = process.env): ConfigPaiement | null {
  const cle = env.PAYIZ_CLE_SECRETE?.trim();
  const jeton = env.PAIEMENT_JETON?.trim();
  if (!cle || !jeton) return null;
  return { cle, jeton, secretWebhook: env.PAYIZ_SECRET_WEBHOOK?.trim() || null, mode: cle.startsWith("sk_live_") ? "reel" : "test" };
}
