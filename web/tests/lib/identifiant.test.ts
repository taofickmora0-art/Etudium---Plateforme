import { afterEach, describe, expect, it, vi } from "vitest";
import { identifiantAleatoire } from "@/lib/identifiant";

// Les noms des fichiers déposés par le navigateur. Sur le Wi-Fi en http (essais sur téléphone), le navigateur ne fournit
// pas crypto.randomUUID (réservé à https et localhost) : l'identifiant doit quand même être produit.

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.restoreAllMocks());

describe("identifiantAleatoire", () => {
  it("avec crypto.randomUUID : le sien", () => {
    vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");
    expect(identifiantAleatoire()).toBe("11111111-1111-4111-8111-111111111111");
  });

  it("sans crypto.randomUUID (http hors localhost) : un UUID v4 tiré de crypto.getRandomValues, différent à chaque appel", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      const a = identifiantAleatoire();
      const b = identifiantAleatoire();
      expect(a).toMatch(UUID_V4);
      expect(b).toMatch(UUID_V4);
      expect(a).not.toBe(b);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
