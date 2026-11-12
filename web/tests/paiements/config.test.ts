import { describe, expect, it } from "vitest";
import { configurationPaiement, etatSasPay, jetonServeur } from "@/lib/paiements/config";

// Le paiement se règle avec la seule clé Payiz (demande du 2 novembre 2026) : le jeton du serveur, que la base reconnaît
// après « Activer les paiements », en est tiré. Plus de PAIEMENT_JETON à fabriquer dans un terminal.

describe("Le jeton du serveur", () => {
  it("tiré de la clé Payiz : stable, long, propre à chaque clé, sans rien laisser voir de la clé", () => {
    const jeton = jetonServeur("sk_test_abc");
    expect(jeton).toMatch(/^[0-9a-f]{64}$/);
    expect(jetonServeur("sk_test_abc")).toBe(jeton);
    expect(jetonServeur("sk_live_abc")).not.toBe(jeton);
    expect(jeton).not.toContain("abc");
  });
});

describe("La configuration du paiement", () => {
  it("la clé Payiz suffit ; sans elle, rien ; PAIEMENT_JETON n'est plus lu", () => {
    expect(configurationPaiement({ PAYIZ_CLE_SECRETE: "sk_test_abc" })).toEqual({ cle: "sk_test_abc", jeton: jetonServeur("sk_test_abc"), secretWebhook: null, mode: "test", saspay: null });
    expect(configurationPaiement({ PAYIZ_CLE_SECRETE: "sk_live_abc", PAIEMENT_JETON: "J".repeat(64), PAYIZ_SECRET_WEBHOOK: "whsec_x" })).toEqual({
      cle: "sk_live_abc",
      jeton: jetonServeur("sk_live_abc"),
      secretWebhook: "whsec_x",
      mode: "reel",
      saspay: null,
    });
    expect(configurationPaiement({ PAIEMENT_JETON: "J".repeat(64) })).toBeNull();
    expect(configurationPaiement({ PAYIZ_CLE_SECRETE: "  " })).toBeNull();
  });
});

describe("SasPay en secours (12 novembre 2026)", () => {
  it("sa clé s'ajoute à celle de Payiz, dans le même mode ; seule, ou d'un autre mode, elle ne sert pas", () => {
    expect(configurationPaiement({ PAYIZ_CLE_SECRETE: "sk_live_p", SASPAY_CLE_SECRETE: " sk_live_s ", SASPAY_SECRET_WEBHOOK: "whsec_s" })?.saspay).toEqual({
      cle: "sk_live_s",
      secretWebhook: "whsec_s",
    });
    expect(configurationPaiement({ PAYIZ_CLE_SECRETE: "sk_test_p", SASPAY_CLE_SECRETE: "sk_test_s" })?.saspay).toEqual({ cle: "sk_test_s", secretWebhook: null });
    // Une clé de test derrière des paiements réels ne ferait circuler aucun argent : ignorée.
    expect(configurationPaiement({ PAYIZ_CLE_SECRETE: "sk_live_p", SASPAY_CLE_SECRETE: "sk_test_s" })?.saspay).toBeNull();
    expect(configurationPaiement({ SASPAY_CLE_SECRETE: "sk_live_s" })).toBeNull();
  });

  it("son état pour le back-office, sans jamais la clé", () => {
    expect(etatSasPay({})).toEqual({ cle: "absente", ignoree: false, webhook: false });
    expect(etatSasPay({ PAYIZ_CLE_SECRETE: "sk_live_p", SASPAY_CLE_SECRETE: "sk_test_s" })).toEqual({ cle: "test", ignoree: true, webhook: false });
    expect(etatSasPay({ PAYIZ_CLE_SECRETE: "sk_live_p", SASPAY_CLE_SECRETE: "sk_live_s", SASPAY_SECRET_WEBHOOK: "w" })).toEqual({ cle: "reel", ignoree: false, webhook: true });
  });
});
