import { afterEach, describe, expect, it, vi } from "vitest";
import { adresseDuSite } from "@/lib/site/adresse";

// L'adresse publique du site (NEXT_PUBLIC_SITE_URL) : liens absolus, certificats, robots.txt et plan du site.
describe("adresseDuSite", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rend l'adresse sans espaces ni « / » final", () => {
    expect(adresseDuSite(" https://etudium.online/ ")).toBe("https://etudium.online");
    expect(adresseDuSite("https://etudium.online//")).toBe("https://etudium.online");
  });

  it("se replie sur http://localhost:3000 en local (variable absente ou vide)", () => {
    expect(adresseDuSite(undefined)).toBe("http://localhost:3000");
    expect(adresseDuSite("   ")).toBe("http://localhost:3000");
  });

  it("lit NEXT_PUBLIC_SITE_URL par défaut", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://etudium.online");
    expect(adresseDuSite()).toBe("https://etudium.online");
  });
});
