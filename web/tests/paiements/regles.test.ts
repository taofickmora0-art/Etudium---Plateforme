import { describe, expect, it } from "vitest";
import type { PaiementPayiz } from "@/lib/paiements/payiz";
import { masquerTelephone, messageEchec, messageErreurPayiz, normaliserTelephone, operateurDuNumero, verdictPayiz } from "@/lib/paiements/regles";

// Le numéro Mobile Money, l'opérateur proposé, les messages d'échec et la lecture d'un paiement Payiz (lot 2).

const payiz = (status: string, essai: Partial<NonNullable<PaiementPayiz["latest_attempt"]>> | null = null): PaiementPayiz => ({
  id: "pay_1",
  status,
  amount: 12000,
  currency: "XOF",
  reference: "p1",
  expires_at: null,
  latest_attempt: essai ? { id: "att_1", status: "pending", failure_code: null, operator: "mtn", phone: "+229 01 •• •• •• 00", ...essai } : null,
});

describe("Le numéro Mobile Money", () => {
  it("se normalise quelle que soit la saisie", () => {
    for (const saisie of ["01 42 00 00 00", "+229 0142000000", "00229 01 42 00 00 00", "229-01-42-00-00-00", "01.42.00.00.00"]) {
      expect(normaliserTelephone(saisie)).toBe("+2290142000000");
    }
    expect(normaliserTelephone("97 00 00 00")).toBe("+2290197000000");
    // L'ancien format à 8 chiffres, avec l'indicatif (finitions du paiement).
    for (const saisie of ["+229 97 00 00 00", "229 97000000", "00229 97 00 00 00"]) expect(normaliserTelephone(saisie)).toBe("+2290197000000");
  });

  it("refuse une longueur fausse, des lettres ou un autre préfixe", () => {
    for (const saisie of ["01 97 00", "abc", "02 42 00 00 00", "", "01 42 00 00 00 00"]) expect(normaliserTelephone(saisie)).toBeNull();
  });

  it("propose l'opérateur d'après le numéro", () => {
    expect(operateurDuNumero("+2290142000000")).toBe("mtn");
    expect(operateurDuNumero("+2290197000000")).toBe("mtn");
    expect(operateurDuNumero("+2290155000000")).toBe("moov");
    expect(operateurDuNumero("+2290140000000")).toBeNull();
  });

  it("se masque, sauf ses deux derniers chiffres", () => {
    expect(masquerTelephone("+2290142000000")).toBe("+229 01 •• •• •• 00");
    expect(masquerTelephone("+2290197123456")).toBe("+229 01 •• •• •• 56");
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
    expect(messageErreurPayiz("operator_required")).toBe("Choisissez votre opérateur, MTN ou Moov.");
    expect(messageErreurPayiz("phone_invalid")).toBe("Ce numéro n’est pas valide. Vérifiez-le.");
    expect(messageErreurPayiz("attempt_in_progress")).toBe("Une demande est déjà en attente sur votre téléphone. Validez-la ou attendez quelques minutes.");
    expect(messageErreurPayiz("operator_unavailable")).toBe(messageEchec("operator_unavailable"));
    expect(messageErreurPayiz("payment_closed")).toBe("Cette demande est close. Recommencez le paiement.");
    expect(messageErreurPayiz("too_many_attempts")).toBe("Trop d’essais sur ce paiement. Recommencez dans quelques minutes.");
    for (const code of ["invalid_api_key", "reseau", "direct_not_enabled"]) {
      expect(messageErreurPayiz(code)).toBe("Le paiement est indisponible pour le moment. Réessayez plus tard.");
    }
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
