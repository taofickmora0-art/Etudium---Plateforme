import { afterEach, describe, expect, it, vi } from "vitest";
import { entetesDeSecurite } from "@/lib/entetes-securite";

// Les en-têtes de sécurité de toutes les pages (spec de la mise en ligne, §1.2) : pas de CSP complète au lancement,
// seulement l'interdiction d'afficher le site dans un cadre ; HSTS sur le site en ligne seulement.
const HSTS = { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" };

describe("entetesDeSecurite", () => {
  it("hors production : les cinq en-têtes, sans HSTS", () => {
    expect(entetesDeSecurite({ production: false })).toEqual([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ]);
  });

  it("en production : HSTS en plus", () => {
    const entetes = entetesDeSecurite({ production: true });
    expect(entetes).toContainEqual(HSTS);
    expect(entetes).toHaveLength(6);
  });
});

describe("next.config.ts", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  const charger = async () => (await import("../../next.config")).default;

  it("pose les en-têtes sur toutes les routes et retire « X-Powered-By »", async () => {
    vi.stubEnv("VERCEL_ENV", "");
    const config = await charger();
    expect(config.poweredByHeader).toBe(false);
    const regles = await config.headers!();
    expect(regles).toHaveLength(1);
    expect(regles[0].source).toBe("/:path*");
    expect(regles[0].headers).toEqual(entetesDeSecurite({ production: false }));
  });

  it("ajoute HSTS pour le build de production Vercel", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://etudium.online");
    const config = await charger();
    const [regle] = await config.headers!();
    expect(regle.headers).toContainEqual(HSTS);
  });

  it("garde les réglages du développement (téléphone sur le Wi-Fi, indicateur masqué)", async () => {
    const config = await charger();
    expect(config.allowedDevOrigins).toEqual(["192.168.*.*", "**.nip.io"]);
    expect(config.devIndicators).toBe(false);
  });

  it("fait échouer le build de production sans NEXT_PUBLIC_SITE_URL", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    await expect(charger()).rejects.toThrow(/NEXT_PUBLIC_SITE_URL/);
  });

  it("fait échouer le build de production avec une adresse en http://", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://etudium.online");
    await expect(charger()).rejects.toThrow(/https:\/\//);
  });

  it("en prévisualisation, l'adresse n'est pas exigée", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    await expect(charger()).resolves.toBeDefined();
  });
});
