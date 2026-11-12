import { createHmac } from "node:crypto";

// Les secrets du paiement (web/.env.local en local, les réglages de l'hébergeur une fois en ligne ; saisis par l'équipe,
// jamais de préfixe NEXT_PUBLIC_) :
// - PAYIZ_CLE_SECRETE : la clé secrète Payiz (sk_test_… en test, sk_live_… en réel) ;
// - PAYIZ_SECRET_WEBHOOK : le secret des notifications signées, une fois le site en ligne.
// Le jeton du serveur (ce qui permet à l'appli, et à elle seule, de noter un paiement reçu dans la base) est tiré de la
// clé Payiz : rien d'autre à fabriquer (demande du 2 novembre 2026). « Activer les paiements » en donne l'empreinte à la
// base, une fois, et de nouveau quand la clé change (passage à sk_live_…).
// SasPay, en secours de Payiz pour les pays et les opérateurs qu'il n'encaisse pas (12 novembre 2026) :
// - SASPAY_CLE_SECRETE : sa clé secrète, autorisée à encaisser (PAYIN ou BOTH), du même mode que celle de Payiz ;
// - SASPAY_SECRET_WEBHOOK : le secret de signature de ses notifications (facultatif : sans lui, l'état est relu).

export type ConfigSasPay = { cle: string; secretWebhook: string | null };

export type ConfigPaiement = {
  cle: string;
  jeton: string;
  secretWebhook: string | null;
  mode: "test" | "reel";
  /** SasPay, en secours ; null sans clé, ou avec une clé d'un autre mode que Payiz. */
  saspay: ConfigSasPay | null;
};

const modeDe = (cle: string): "test" | "reel" => (cle.startsWith("sk_live_") ? "reel" : "test");

/** Le jeton du serveur : une empreinte de la clé Payiz (64 caractères hexadécimaux), qui ne laisse rien voir de la clé. */
export function jetonServeur(cle: string): string {
  return createHmac("sha256", cle).update("etudium:jeton-des-paiements").digest("hex");
}

/** La configuration du paiement ; null sans clé Payiz. */
export function configurationPaiement(env: Record<string, string | undefined> = process.env): ConfigPaiement | null {
  const cle = env.PAYIZ_CLE_SECRETE?.trim();
  if (!cle) return null;
  const mode = modeDe(cle);
  const cleSasPay = env.SASPAY_CLE_SECRETE?.trim();
  // Une clé de test derrière des paiements réels (ou l'inverse) ne servirait pas : elle est ignorée.
  const saspay = cleSasPay && modeDe(cleSasPay) === mode ? { cle: cleSasPay, secretWebhook: env.SASPAY_SECRET_WEBHOOK?.trim() || null } : null;
  return { cle, jeton: jetonServeur(cle), secretWebhook: env.PAYIZ_SECRET_WEBHOOK?.trim() || null, mode, saspay };
}

/** L'état de SasPay pour le back-office, sans jamais la clé : son mode, et s'il est ignoré (autre mode que Payiz). */
export function etatSasPay(env: Record<string, string | undefined> = process.env): { cle: "absente" | "test" | "reel"; ignoree: boolean; webhook: boolean } {
  const cle = env.SASPAY_CLE_SECRETE?.trim();
  const payiz = env.PAYIZ_CLE_SECRETE?.trim();
  const webhook = Boolean(env.SASPAY_SECRET_WEBHOOK?.trim());
  if (!cle) return { cle: "absente", ignoree: false, webhook };
  return { cle: modeDe(cle), ignoree: Boolean(payiz) && modeDe(payiz!) !== modeDe(cle), webhook };
}
