import { describe, expect, it } from "vitest";
import { assertNoSecretKey, assertSiteUrlEnProduction, EnvError, readPublicEnv } from "@/lib/env";
import { urlCouverture } from "@/lib/couvertures/adresse";

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const fakeJwt = (payload: object) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;

const URL_OK = "https://abcd.supabase.co";

function readError(source: Record<string, string | undefined>): EnvError {
  try {
    readPublicEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error;
    throw error;
  }
  throw new Error("readPublicEnv aurait dû lever une EnvError");
}

describe("readPublicEnv", () => {
  it("l'adresse de l'API des données collée à la place de celle du projet (« …/rest/v1/ ») est ramenée au projet", () => {
    // Mise en ligne du 3 novembre 2026 : l'inscription échouait sans rien laisser dans le journal de Supabase.
    for (const saisie of ["https://abcd.supabase.co/rest/v1/", "https://abcd.supabase.co/rest/v1", " https://abcd.supabase.co/auth/v1/ ", "https://abcd.supabase.co/storage/v1"]) {
      expect(readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: saisie, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" }).supabaseUrl).toBe("https://abcd.supabase.co");
    }
    expect(urlCouverture("f1/a.jpg", "https://abcd.supabase.co/rest/v1/")).toBe("https://abcd.supabase.co/storage/v1/object/public/couvertures/f1/a.jpg");
  });

  it("accepte une URL et une clé publishable", () => {
    expect(
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://abcd.supabase.co/ ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz",
      }),
    ).toEqual({ supabaseUrl: "https://abcd.supabase.co", supabaseKey: "sb_publishable_xyz" });
  });

  it("accepte une clé anon au format JWT", () => {
    const key = fakeJwt({ role: "anon" });
    expect(readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }).supabaseKey).toBe(key);
  });

  it("refuse une URL vide", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: "  ", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(error.message).toContain("web/.env.local");
  });

  it("refuse une URL sans https", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: "abcd.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(error.message).toContain("https://");
  });

  it("refuse une clé vide", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("refuse une clé secrète sb_secret_", () => {
    const secret = "sb_secret_NE_DOIT_JAMAIS_APPARAITRE";
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(error.message).toContain("secrète");
    expect(error.message).not.toContain(secret);
  });

  it("refuse une clé secrète collée entre guillemets", () => {
    const secret = "“sb_secret_ENTRE_GUILLEMETS”";
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(error.message).toContain("secrète");
    expect(error.message).not.toContain("ENTRE_GUILLEMETS");
  });

  it("refuse une clé secrète précédée de Bearer", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "Bearer sb_secret_AVEC_PREFIXE" });
    expect(error.message).toContain("secrète");
    expect(error.message).not.toContain("AVEC_PREFIXE");
  });

  it("refuse une clé qui n'est pas une clé publique Supabase", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "ma-cle-au-hasard" });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(error.message).toContain("n’est pas une clé publique");
    expect(error.message).not.toContain("ma-cle-au-hasard");
  });

  it("refuse un JWT service_role", () => {
    const secret = fakeJwt({ role: "service_role" });
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(error.message).toContain("secrète");
    expect(error.message).not.toContain(secret);
  });
});

describe("assertNoSecretKey (contrôle au démarrage de Next)", () => {
  it("bloque le démarrage si une clé secrète est présente", () => {
    expect(() => assertNoSecretKey({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_AU_DEMARRAGE" })).toThrow(/secrète/);
  });

  it("bloque le démarrage pour un JWT service_role", () => {
    expect(() => assertNoSecretKey({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fakeJwt({ role: "service_role" }) })).toThrow(/secrète/);
  });

  it("laisse démarrer quand la clé est absente (la page affichera Configuration manquante)", () => {
    expect(() => assertNoSecretKey({})).not.toThrow();
  });

  it("laisse démarrer avec une clé publique", () => {
    expect(() => assertNoSecretKey({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" })).not.toThrow();
  });
});

describe("assertSiteUrlEnProduction (contrôle du build de production Vercel)", () => {
  function erreurSite(source: Record<string, string | undefined>): EnvError {
    try {
      assertSiteUrlEnProduction(source);
    } catch (error) {
      if (error instanceof EnvError) return error;
      throw error;
    }
    throw new Error("assertSiteUrlEnProduction aurait dû lever une EnvError");
  }

  it("exige NEXT_PUBLIC_SITE_URL pour le build de production, avec un message clair", () => {
    const error = erreurSite({ VERCEL_ENV: "production" });
    expect(error.variable).toBe("NEXT_PUBLIC_SITE_URL");
    expect(error.message).toContain("NEXT_PUBLIC_SITE_URL");
    expect(error.message).toContain("https://etudium.online");
    expect(error.message).toContain("Vercel");
  });

  it("refuse une adresse faite d'espaces", () => {
    expect(erreurSite({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "   " }).variable).toBe("NEXT_PUBLIC_SITE_URL");
  });

  it("refuse une adresse sans https:// en production", () => {
    const error = erreurSite({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://etudium.online" });
    expect(error.message).toContain("https://");
  });

  it("refuse une adresse illisible en production", () => {
    expect(erreurSite({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://" }).variable).toBe("NEXT_PUBLIC_SITE_URL");
  });

  it("accepte l'adresse du site en https://", () => {
    expect(() => assertSiteUrlEnProduction({ VERCEL_ENV: "production", NEXT_PUBLIC_SITE_URL: " https://etudium.online/ " })).not.toThrow();
  });

  it("n'exige rien en local ni en prévisualisation", () => {
    expect(() => assertSiteUrlEnProduction({})).not.toThrow();
    expect(() => assertSiteUrlEnProduction({ VERCEL_ENV: "preview" })).not.toThrow();
    expect(() => assertSiteUrlEnProduction({ VERCEL_ENV: "development", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" })).not.toThrow();
    expect(() => assertSiteUrlEnProduction({ NODE_ENV: "production" })).not.toThrow();
  });
});
