import { describe, expect, it } from "vitest";
import { authErrorMessage, safeNext } from "@/lib/auth/messages";

describe("Messages d'erreur", () => {
  it("les erreurs Supabase sont traduites", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toBe("E-mail ou mot de passe incorrect.");
    expect(authErrorMessage({ code: "otp_expired" })).toBe("Ce code est incorrect ou a expiré. Demandez-en un nouveau.");
    expect(authErrorMessage({ code: "over_email_send_rate_limit" })).toBe("Trop de demandes. Patientez une minute, puis réessayez.");
    expect(authErrorMessage({ code: "over_request_rate_limit" })).toBe("Trop de demandes. Patientez une minute, puis réessayez.");
    expect(authErrorMessage({ status: 429 })).toBe("Trop de demandes. Patientez une minute, puis réessayez.");
    expect(authErrorMessage({ code: "weak_password" })).toBe("Choisissez un mot de passe d’au moins 8 caractères.");
    expect(authErrorMessage({ code: "same_password" })).toBe("Choisissez un mot de passe différent de l’ancien.");
    expect(authErrorMessage({ code: "email_address_invalid" })).toBe("Cette adresse e-mail n’est pas acceptée.");
    expect(authErrorMessage({ code: "signup_disabled" })).toBe("Les inscriptions sont fermées pour le moment.");
    expect(authErrorMessage({ code: "unexpected_failure" })).toBe("Une erreur est survenue. Vérifiez votre connexion, puis réessayez.");
    expect(authErrorMessage(null)).toBe("Une erreur est survenue. Vérifiez votre connexion, puis réessayez.");
  });

  it("safeNext refuse les adresses extérieures", () => {
    expect(safeNext("https://pirate.example")).toBe("/accueil");
    expect(safeNext("//pirate.example")).toBe("/accueil");
    expect(safeNext("/\\pirate.example")).toBe("/accueil");
    expect(safeNext("")).toBe("/accueil");
    expect(safeNext(null)).toBe("/accueil");
    expect(safeNext("/certificats")).toBe("/certificats");
    expect(safeNext("/formations?parcours=digital")).toBe("/formations?parcours=digital");
    expect(safeNext(undefined, "/connexion")).toBe("/connexion");
  });

  it("safeNext refuse les caractères invisibles que les navigateurs effacent (« /\\t/pirate » devient « //pirate »)", () => {
    expect(safeNext("/\t/pirate.example")).toBe("/accueil");
    expect(safeNext("/\n/pirate.example")).toBe("/accueil");
    expect(safeNext("/\r\n/pirate.example")).toBe("/accueil");
    expect(safeNext("/\t\\pirate.example")).toBe("/accueil");
    expect(safeNext("/certificats#attestation")).toBe("/certificats#attestation");
  });
});
