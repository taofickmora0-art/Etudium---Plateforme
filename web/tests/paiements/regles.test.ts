import { describe, expect, it } from "vitest";
import type { PaiementPayiz } from "@/lib/paiements/payiz";
import { indicatifDuPays, nomPays } from "@/lib/paiements/pays";
import {
  codeOperateurValide,
  masquerTelephone,
  messageEchec,
  messageErreurPayiz,
  messageOperateurRequis,
  MOYENS_REPLI,
  normaliserTelephone,
  operateurDuNumero,
  verdictPayiz,
} from "@/lib/paiements/regles";

// Le numéro Mobile Money (tous pays depuis le 3 novembre 2026), l'opérateur proposé, les messages d'échec et la lecture
// d'un paiement Payiz (lot 2).

const payiz = (status: string, essai: Partial<NonNullable<PaiementPayiz["latest_attempt"]>> | null = null): PaiementPayiz => ({
  id: "pay_1",
  status,
  amount: 12000,
  currency: "XOF",
  reference: "p1",
  expires_at: null,
  latest_attempt: essai ? { id: "att_1", status: "pending", failure_code: null, operator: "mtn", phone: "+229 01 •• •• •• 00", ...essai } : null,
});

const BENIN = { code: "BEN", indicatif: "+229" };
const COTE_IVOIRE = { code: "CIV", indicatif: "+225" };
const TOGO = { code: "TGO", indicatif: "+228" };
const SENEGAL = { code: "SEN", indicatif: "+221" };
const GHANA = { code: "GHA", indicatif: "+233" };

describe("Le numéro Mobile Money au Bénin (règle d'avant, gardée)", () => {
  it("se normalise quelle que soit la saisie", () => {
    for (const saisie of ["01 42 00 00 00", "+229 0142000000", "00229 01 42 00 00 00", "229-01-42-00-00-00", "01.42.00.00.00"]) {
      expect(normaliserTelephone(saisie, BENIN)).toBe("+2290142000000");
    }
    expect(normaliserTelephone("97 00 00 00", BENIN)).toBe("+2290197000000");
    // L'ancien format à 8 chiffres, avec l'indicatif (finitions du paiement).
    for (const saisie of ["+229 97 00 00 00", "229 97000000", "00229 97 00 00 00"]) expect(normaliserTelephone(saisie, BENIN)).toBe("+2290197000000");
  });

  it("refuse une longueur fausse, des lettres, un autre préfixe ou l'indicatif d'un autre pays", () => {
    for (const saisie of ["01 97 00", "abc", "02 42 00 00 00", "", "01 42 00 00 00 00", "+225 07 07 00 00 00"]) {
      expect(normaliserTelephone(saisie, BENIN)).toBeNull();
    }
  });

  it("propose l'opérateur d'après les préfixes du repli (MTN, Moov)", () => {
    const benin = MOYENS_REPLI.pays[0];
    expect(operateurDuNumero("+2290142000000", benin)).toBe("mtn");
    expect(operateurDuNumero("+2290197000000", benin)).toBe("mtn");
    expect(operateurDuNumero("+2290155000000", benin)).toBe("moov");
    expect(operateurDuNumero("+2290140000000", benin)).toBeNull();
  });
});

describe("Le numéro Mobile Money dans les autres pays", () => {
  it("avec ou sans indicatif, avec espaces, points ou tirets : « +<indicatif><numéro> »", () => {
    for (const saisie of ["07 07 00 00 00", "+225 07 07 00 00 00", "00225-07-07-00-00-00", "225 0707000000", "07.07.00.00.00"]) {
      expect(normaliserTelephone(saisie, COTE_IVOIRE)).toBe("+2250707000000");
    }
    for (const saisie of ["90 12 34 56", "+228 90 12 34 56", "22890123456"]) expect(normaliserTelephone(saisie, TOGO)).toBe("+22890123456");
    for (const saisie of ["77 123 45 67", "+221 77 123 45 67", "00221771234567"]) expect(normaliserTelephone(saisie, SENEGAL)).toBe("+221771234567");
  });

  it("le 0 national tombe là où il ne fait pas partie du numéro international (Ghana)", () => {
    for (const saisie of ["024 123 4567", "+233 24 123 4567", "233241234567"]) expect(normaliserTelephone(saisie, GHANA)).toBe("+233241234567");
  });

  it("la validité fine reste à Payiz ; refusés : lettres, trop court, trop long, autre indicatif", () => {
    for (const saisie of ["abc", "12 34", "1234567890123456", "+229 01 42 00 00 00", ""]) expect(normaliserTelephone(saisie, TOGO)).toBeNull();
  });

  it("choisit l'opérateur d'après les préfixes de Payiz : le plus long l'emporte, une égalité ne choisit rien", () => {
    const togo = {
      ...TOGO,
      operateurs: [
        { code: "togocel", prefixes: ["90", "91", "92", "93", "70"] },
        { code: "moov", prefixes: ["96", "97", "98", "99", "79"] },
        { code: "autre", prefixes: ["9012"] },
        { code: "double", prefixes: ["91"] },
        { code: "sans_prefixe", prefixes: [] },
      ],
    };
    expect(operateurDuNumero("+22896123456", togo)).toBe("moov");
    expect(operateurDuNumero("+22890123456", togo)).toBe("autre");
    expect(operateurDuNumero("+22890553456", togo)).toBe("togocel");
    // « 91 » : deux opérateurs ; « 60 » : aucun.
    expect(operateurDuNumero("+22891123456", togo)).toBeNull();
    expect(operateurDuNumero("+22860123456", togo)).toBeNull();
  });

  it("au Bénin, des préfixes de l'ancien format (sans « 01 ») se reconnaissent aussi", () => {
    const benin = { ...BENIN, operateurs: [{ code: "celtiis", prefixes: ["40", "41", "43", "44"] }, { code: "mtn", prefixes: ["0142", "0197"] }] };
    expect(operateurDuNumero("+2290143000000", benin)).toBe("celtiis");
    expect(operateurDuNumero("+2290197000000", benin)).toBe("mtn");
  });

  it("le numéro masqué : l'indicatif, des points, puis les deux derniers chiffres", () => {
    expect(masquerTelephone("+2290142000000", "+229")).toBe("+229 •• •• •• •• 00");
    expect(masquerTelephone("+2290197123456", "+229")).toBe("+229 •• •• •• •• 56");
    expect(masquerTelephone("+221771234567", "+221")).toBe("+221 •• •• •• •• 67");
  });

  it("un code d'opérateur : minuscules, chiffres, « _ » et « - », 40 caractères au plus", () => {
    for (const code of ["mtn", "moov", "celtiis", "orange_money", "t-money", "a".repeat(40)]) expect(codeOperateurValide(code)).toBe(true);
    for (const code of ["", "MTN", "mtn bj", "a".repeat(41), null, 12]) expect(codeOperateurValide(code)).toBe(false);
  });
});

describe("Le repli (Payiz sans réponse)", () => {
  it("le Bénin, avec MTN et Moov", () => {
    expect(MOYENS_REPLI.repli).toBe(true);
    expect(MOYENS_REPLI.pays.map((p) => [p.code, p.nom, p.indicatif])).toEqual([["BEN", "Bénin", "+229"]]);
    expect(MOYENS_REPLI.pays[0].operateurs.map((o) => [o.code, o.nom])).toEqual([
      ["mtn", "MTN Mobile Money"],
      ["moov", "Moov Money"],
    ]);
  });
});

describe("Les pays", () => {
  it("leur nom en français ; un code inconnu reste tel quel", () => {
    expect(nomPays("BEN")).toBe("Bénin");
    expect(nomPays("CIV")).toBe("Côte d’Ivoire");
    expect(nomPays("TGO")).toBe("Togo");
    expect(nomPays("SEN")).toBe("Sénégal");
    expect(nomPays("XYZ")).toBe("XYZ");
  });

  it("leur indicatif, connu d'avance pour les pays d'Afrique", () => {
    expect(indicatifDuPays("BEN")).toBe("+229");
    expect(indicatifDuPays("CIV")).toBe("+225");
    expect(indicatifDuPays("ZAF")).toBe("+27");
    expect(indicatifDuPays("XYZ")).toBeNull();
  });
});

describe("Les messages", () => {
  it("chaque motif d'échec a son texte", () => {
    expect(messageEchec("insufficient_funds")).toBe("Votre solde Mobile Money est insuffisant. Rechargez puis réessayez.");
    expect(messageEchec("payer_declined")).toBe("Vous avez refusé la demande sur votre téléphone.");
    expect(messageEchec("timeout")).toBe("La demande n’a pas été validée à temps.");
    expect(messageEchec("invalid_phone")).toBe("Ce numéro n’est pas reconnu par l’opérateur.");
    expect(messageEchec("operator_limit")).toBe("Votre plafond Mobile Money est atteint.");
    expect(messageEchec("operator_unavailable")).toBe("L’opérateur ne répond pas pour le moment. Réessayez dans quelques minutes.");
    for (const motif of ["declined", "unknown", null]) expect(messageEchec(motif)).toBe("Le paiement n’a pas abouti.");
  });

  it("chaque erreur de Payiz a son texte", () => {
    expect(messageErreurPayiz("operator_required")).toBe("Choisissez votre opérateur.");
    expect(messageErreurPayiz("phone_invalid")).toBe("Ce numéro n’est pas valide pour le pays choisi. Vérifiez-le.");
    expect(messageErreurPayiz("country_unavailable")).toBe("Le paiement n’est pas proposé dans ce pays pour le moment. Choisissez un autre pays.");
    expect(messageErreurPayiz("currency_unavailable")).toBe(
      "Ce moyen de paiement n’accepte pas le franc CFA pour le moment. Choisissez un autre opérateur ou un autre pays.",
    );
    expect(messageErreurPayiz("exchange_rate_unavailable")).toBe(
      "La conversion vers la monnaie de votre opérateur est indisponible pour le moment. Réessayez plus tard ou choisissez un autre opérateur.",
    );
    expect(messageErreurPayiz("operator_limit")).toBe(messageEchec("operator_limit"));
    expect(messageErreurPayiz("amount_out_of_range")).toBe("Ce montant dépasse les limites de cet opérateur. Choisissez un autre opérateur.");
    expect(messageErreurPayiz("payment_declined")).toBe("Le paiement a été refusé. Essayez un autre numéro ou un autre opérateur.");
    expect(messageErreurPayiz("attempt_in_progress")).toBe("Une demande est déjà en attente sur votre téléphone. Validez-la ou attendez quelques minutes.");
    expect(messageErreurPayiz("operator_unavailable")).toBe(messageEchec("operator_unavailable"));
    expect(messageErreurPayiz("payment_closed")).toBe("Cette demande est close. Recommencez le paiement.");
    expect(messageErreurPayiz("too_many_attempts")).toBe("Trop d’essais sur ce paiement. Recommencez dans quelques minutes.");
    for (const code of ["invalid_api_key", "reseau", "direct_not_enabled"]) {
      expect(messageErreurPayiz(code)).toBe("Le paiement est indisponible pour le moment. Réessayez plus tard.");
    }
  });
});

describe("L'opérateur demandé par Payiz", () => {
  it("les candidats sont nommés", () => {
    expect(messageOperateurRequis([])).toBe("Choisissez votre opérateur.");
    expect(messageOperateurRequis(["MTN Mobile Money"])).toBe("Choisissez votre opérateur : MTN Mobile Money.");
    expect(messageOperateurRequis(["MTN Mobile Money", "Moov Money"])).toBe("Choisissez votre opérateur : MTN Mobile Money ou Moov Money.");
    expect(messageOperateurRequis(["MTN Mobile Money", "Moov Money", "Celtiis Cash"])).toBe(
      "Choisissez votre opérateur : MTN Mobile Money, Moov Money ou Celtiis Cash.",
    );
  });
});

describe("Lire un paiement Payiz", () => {
  it("réussi : confirmer avec son montant", () => {
    expect(verdictPayiz(payiz("succeeded", { status: "succeeded" }))).toEqual({ action: "confirmer", montant: 12000 });
  });

  it("en cours ou essai en attente : attendre", () => {
    expect(verdictPayiz(payiz("processing", { status: "pending" }))).toEqual({ action: "attendre" });
    expect(verdictPayiz(payiz("requires_payment", { status: "pending" }))).toEqual({ action: "attendre" });
  });

  it("essai échoué ou expiré : l'échec avec son motif", () => {
    expect(verdictPayiz(payiz("requires_payment", { status: "failed", failure_code: "insufficient_funds" }))).toEqual({
      action: "echec",
      statut: "echoue",
      motif: "insufficient_funds",
    });
    expect(verdictPayiz(payiz("requires_payment", { status: "expired" }))).toEqual({ action: "echec", statut: "echoue", motif: "timeout" });
  });

  it("un paiement remboursé avant d'avoir été vu réussi n'ouvre rien ; un remboursement partiel reste un paiement", () => {
    expect(verdictPayiz(payiz("refunded"))).toEqual({ action: "echec", statut: "annule", motif: null });
    expect(verdictPayiz(payiz("partially_refunded"))).toEqual({ action: "confirmer", montant: 12000 });
  });

  it("demande expirée ou annulée", () => {
    expect(verdictPayiz(payiz("expired"))).toEqual({ action: "echec", statut: "expire", motif: null });
    expect(verdictPayiz(payiz("canceled"))).toEqual({ action: "echec", statut: "annule", motif: null });
  });
});
