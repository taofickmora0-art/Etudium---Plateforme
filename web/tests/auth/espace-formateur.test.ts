import { describe, expect, it, vi } from "vitest";
import { accueilDe, cheminFormateur, estFormateurConnecte } from "@/lib/auth/espace-formateur";

// Restructuration R1 : un formateur n'a plus l'espace étudiant. Une adresse étudiante le mène à l'équivalent de son
// espace, sinon à son tableau de bord.

describe("Où va un formateur", () => {
  it("ses pages de compte et sa communauté ont leur équivalent dans son espace", () => {
    expect(cheminFormateur("/profil")).toBe("/formateur/profil");
    expect(cheminFormateur("/notifications")).toBe("/formateur/notifications");
    expect(cheminFormateur("/menu")).toBe("/formateur/menu");
    expect(cheminFormateur("/messages")).toBe("/formateur/messages");
    expect(cheminFormateur("/communaute/publications/abc")).toBe("/formateur/communaute/publications/abc");
  });

  it("le reste mène à son tableau de bord ; une adresse de son espace ne change pas", () => {
    expect(cheminFormateur("/accueil")).toBe("/formateur");
    expect(cheminFormateur("/accueil?espace=general")).toBe("/formateur");
    expect(cheminFormateur("/evenements")).toBe("/formateur");
    expect(cheminFormateur("/formations/excel/lecons/x")).toBe("/formateur");
    expect(cheminFormateur("/profil?onglet=securite")).toBe("/formateur/profil");
    expect(cheminFormateur("/formateur/sessions")).toBe("/formateur/sessions");
    expect(cheminFormateur("/formateur/messages?c=1")).toBe("/formateur/messages?c=1");
  });

  it("l'accueil d'un compte : son tableau de bord pour un formateur, l'Accueil pour les autres", () => {
    expect(accueilDe(["etudiant", "formateur"])).toBe("/formateur");
    expect(accueilDe(["etudiant", "admin"])).toBe("/accueil");
    expect(accueilDe(["etudiant"])).toBe("/accueil");
  });

  it("le compte connecté est-il formateur ? la base le dit ; non en cas de doute", async () => {
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    expect(await estFormateurConnecte({ rpc })).toBe(true);
    expect(rpc).toHaveBeenCalledWith("a_role", { r: "formateur" });
    expect(await estFormateurConnecte({ rpc: async () => ({ data: null, error: { message: "panne" } }) })).toBe(false);
    expect(await estFormateurConnecte({ rpc: async () => Promise.reject(new Error("réseau")) })).toBe(false);
  });
});
