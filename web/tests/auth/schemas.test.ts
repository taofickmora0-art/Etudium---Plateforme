import { describe, expect, it } from "vitest";
import { codeSchema, emailSchema, newPasswordSchema, passwordSchema, signUpSchema } from "@/lib/auth/schemas";

const firstMessage = (r: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) => r.error?.issues[0];

describe("Règles de saisie", () => {
  it("l'adresse est nettoyée", () => {
    expect(emailSchema.parse("  Aicha.K@Exemple.com ")).toBe("aicha.k@exemple.com");
    expect(firstMessage(emailSchema.safeParse("aicha@"))?.message).toBe("Entrez une adresse e-mail valide.");
  });

  it("le mot de passe fait au moins 8 caractères", () => {
    expect(firstMessage(passwordSchema.safeParse("1234567"))?.message).toBe("Au moins 8 caractères.");
    expect(passwordSchema.safeParse("12345678").success).toBe(true);
  });

  it("les conditions sont obligatoires", () => {
    const r = signUpSchema.safeParse({ prenom: "Aïcha", nom: "Kpadé", email: "a@b.co", password: "motdepasse" });
    expect(r.success).toBe(false);
    expect(firstMessage(r)?.path).toEqual(["conditions"]);
    expect(firstMessage(r)?.message).toBe("Acceptez les conditions pour créer votre compte.");
  });

  it("prénom et nom sont requis", () => {
    const r = signUpSchema.safeParse({ prenom: " ", nom: "", email: "a@b.co", password: "motdepasse", conditions: "on" });
    expect(r.error?.issues.map((i) => i.message)).toEqual(["Entrez votre prénom.", "Entrez votre nom."]);
  });

  it("le code fait 6 chiffres", () => {
    expect(codeSchema.safeParse("48291").success).toBe(false);
    expect(codeSchema.safeParse("48a913").success).toBe(false);
    expect(firstMessage(codeSchema.safeParse("48291"))?.message).toBe("Saisissez les 6 chiffres du code.");
    expect(codeSchema.parse("482913")).toBe("482913");
  });

  it("les deux mots de passe doivent correspondre", () => {
    const r = newPasswordSchema.safeParse({ password: "motdepasse", confirmation: "motdepassE" });
    expect(firstMessage(r)?.message).toBe("Les deux mots de passe ne correspondent pas.");
    expect(firstMessage(r)?.path).toEqual(["confirmation"]);
  });
});
