import { createHmac } from "node:crypto";

// Les secrets du paiement (web/.env.local en local, les réglages de l'hébergeur une fois en ligne ; saisis par l'équipe,
// jamais de préfixe NEXT_PUBLIC_) :
// - PAYIZ_CLE_SECRETE : la clé secrète Payiz (sk_test_… en test, sk_live_… en réel) ;
// - PAYIZ_SECRET_WEBHOOK : le secret des notifications signées, une fois le site en ligne.
// Le jeton du serveur (ce qui permet à l'appli, et à elle seule, de noter un paiement reçu dans la base) est tiré de la
// clé Payiz : rien d'autre à fabriquer (demande du 2 novembre 2026). « Activer les paiements » en donne l'empreinte à la
// base, une fois, et de nouveau quand la clé change (passage à sk_live_…).

export type ConfigPaiement = { cle: string; jeton: string; secretWebhook: string | null; mode: "test" | "reel" };

/** Le jeton du serveur : une empreinte de la clé Payiz (64 caractères hexadécimaux), qui ne laisse rien voir de la clé. */
export function jetonServeur(cle: string): string {
  return createHmac("sha256", cle).update("etudium:jeton-des-paiements").digest("hex");
}

/** La configuration du paiement ; null sans clé Payiz. */
export function configurationPaiement(env: Record<string, string | undefined> = process.env): ConfigPaiement | null {
  const cle = env.PAYIZ_CLE_SECRETE?.trim();
  if (!cle) return null;
  return { cle, jeton: jetonServeur(cle), secretWebhook: env.PAYIZ_SECRET_WEBHOOK?.trim() || null, mode: cle.startsWith("sk_live_") ? "reel" : "test" };
}
