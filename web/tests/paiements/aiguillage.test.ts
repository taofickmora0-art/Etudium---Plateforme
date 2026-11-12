import { describe, expect, it } from "vitest";
import type { MoyensDePaiement, OperateurPaiement, PaysPaiement } from "@/lib/abonnement/types";
import { fusionnerMoyens, memeOperateur } from "@/lib/paiements/aiguillage";

// L'aiguillage (12 novembre 2026, repris de flashSMS) : une seule liste, l'union de Payiz et de SasPay. Un opérateur que
// Payiz encaisse part chez Payiz ; SasPay ne fait que combler. Le prestataire reste sur le serveur : la liste envoyée au
// navigateur ne le nomme jamais.

const op = (code: string, nom: string, extra: Partial<OperateurPaiement> = {}): OperateurPaiement => ({
  code,
  nom,
  logo: null,
  prefixes: [],
  devise: "XOF",
  montantAPayer: null,
  minimum: null,
  maximum: null,
  ...extra,
});
const pays = (code: string, nom: string, indicatif: string, operateurs: OperateurPaiement[]): PaysPaiement => ({ code, nom, indicatif, operateurs });

const PAYIZ: MoyensDePaiement = {
  repli: false,
  pays: [
    pays("BEN", "Bénin", "+229", [op("mtn", "MTN Mobile Money", { logo: "https://payiz.example/mtn.png", prefixes: ["0196"] }), op("moov", "Moov Money"), op("celtiis", "Celtiis Cash")]),
    pays("TGO", "Togo", "+228", [op("moov", "Moov Money"), op("yas", "Mixx by Yas")]),
  ],
};
const SASPAY: PaysPaiement[] = [
  pays("BEN", "Bénin", "+229", [op("mtn_bj", "MTN MoMo"), op("moov_bj", "Moov Money"), op("celtiis_bj", "Celtiis Cash")]),
  pays("BFA", "Burkina Faso", "+226", [op("orange_bf", "Orange Money", { validation: "code", consigne: "Composez *144*4*6*{montant}#." }), op("moov_bf", "Moov Money")]),
  pays("CIV", "Côte d’Ivoire", "+225", [op("wave_ci", "Wave", { validation: "page" }), op("mtn_ci", "MTN MoMo")]),
  pays("TGO", "Togo", "+228", [op("moov_tg", "Moov Money Flooz"), op("togocel", "Mixx by Yas (ex-T-Money)")]),
];

describe("Le même opérateur chez les deux", () => {
  it("même marque (« mtn » / « mtn_bj ») ou ancien nom connu (Togocel / Yas, Vodafone / Telecel)", () => {
    expect(memeOperateur(op("mtn", "MTN"), op("mtn_bj", "MTN MoMo"))).toBe(true);
    expect(memeOperateur(op("orange_money", "Orange Money"), op("orange_ci", "Orange Money"))).toBe(true);
    expect(memeOperateur(op("yas", "Mixx by Yas"), op("togocel", "Mixx by Yas (ex-T-Money)"))).toBe(true);
    expect(memeOperateur(op("telecel", "Telecel Cash"), op("vodafone_gh", "Telecel Cash (ex-Vodafone Cash)"))).toBe(true);
    expect(memeOperateur(op("mtn", "MTN"), op("moov_bj", "Moov Money"))).toBe(false);
  });
});

describe("La fusion", () => {
  it("Payiz d'abord ; SasPay comble les pays et les opérateurs manquants ; le Bénin en tête, puis par nom", () => {
    const { moyens, prestataireDe } = fusionnerMoyens(PAYIZ, SASPAY, 15000)!;
    expect(moyens.repli).toBe(false);
    expect(moyens.pays.map((p) => [p.code, p.operateurs.map((o) => o.code)])).toEqual([
      ["BEN", ["mtn", "moov", "celtiis"]],
      ["BFA", ["orange_bf", "moov_bf"]],
      ["CIV", ["wave_ci", "mtn_ci"]],
      ["TGO", ["moov", "yas"]],
    ]);
    expect(prestataireDe("BEN", "mtn")).toBe("payiz");
    expect(prestataireDe("CIV", "wave_ci")).toBe("saspay");
    expect(prestataireDe("TGO", "togocel")).toBeNull();
    // Sans opérateur choisi : Payiz le déduit du numéro, là où il encaisse ; ailleurs, il faut le choisir.
    expect(prestataireDe("BEN", null)).toBe("payiz");
    expect(prestataireDe("CIV", null)).toBeNull();
  });

  it("la consigne du code porte le montant ; le logo de la même marque chez Payiz est repris", () => {
    const { moyens } = fusionnerMoyens(PAYIZ, SASPAY, 12000)!;
    const tous = moyens.pays.flatMap((p) => p.operateurs);
    expect(tous.find((o) => o.code === "orange_bf")?.consigne).toBe("Composez *144*4*6*12000#.");
    expect(tous.find((o) => o.code === "mtn_ci")?.logo).toBe("https://payiz.example/mtn.png");
    expect(fusionnerMoyens(PAYIZ, SASPAY, null)!.moyens.pays.find((p) => p.code === "BFA")?.operateurs[0].consigne).toBe("Composez *144*4*6*montant#.");
  });

  it("la liste envoyée au navigateur ne nomme aucun prestataire", () => {
    const { moyens } = fusionnerMoyens(PAYIZ, SASPAY, 15000)!;
    expect(JSON.stringify(moyens)).not.toMatch(/saspay|prestataire/i);
  });

  it("l'un muet : l'autre seul ; les deux : null", () => {
    expect(fusionnerMoyens(PAYIZ, null, 15000)!.moyens).toEqual(PAYIZ);
    const seul = fusionnerMoyens(null, SASPAY, 15000)!;
    expect(seul.moyens.pays[0].code).toBe("BEN");
    expect(seul.prestataireDe("BEN", "mtn_bj")).toBe("saspay");
    expect(seul.prestataireDe("BEN", null)).toBeNull();
    expect(fusionnerMoyens(null, null, 15000)).toBeNull();
  });
});
