import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Les cookies de session Supabase sont « secure » en production (servis en https seulement) ; le reste ne change pas :
// sameSite et path de Supabase, durée choisie par « Se souvenir de moi ».
type Options = { cookieOptions?: Record<string, unknown> };
const capture = vi.hoisted(() => ({ serveur: [] as Options[], navigateur: [] as Options[] }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _cle: string, options: Options) => {
    capture.serveur.push(options);
    return { auth: { getClaims: async () => ({ data: null, error: null }) } };
  },
  createBrowserClient: (_url: string, _cle: string, options: Options) => {
    capture.navigateur.push(options);
    return {};
  },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], get: () => undefined, set: () => {} }) }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ supabaseUrl: "https://projet.supabase.co", supabaseKey: "cle-publique" }) }));

const { optionsCookiesSupabase, withRememberChoice } = await import("@/lib/auth/session-cookies");
const { createClient: clientServeur } = await import("@/lib/supabase/server");
const { createClient: clientNavigateur } = await import("@/lib/supabase/client");
const { proxy } = await import("@/proxy");

const TRENTE_JOURS = 30 * 24 * 60 * 60;
const derniere = (liste: Options[]) => liste[liste.length - 1]?.cookieOptions ?? {};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("optionsCookiesSupabase", () => {
  it("secure en production", () => {
    expect(optionsCookiesSupabase("production")).toEqual({ secure: true });
  });

  it("rien de plus en développement et pendant les tests (http://localhost)", () => {
    expect(optionsCookiesSupabase("development")).toEqual({});
    expect(optionsCookiesSupabase("test")).toEqual({});
    expect(optionsCookiesSupabase(undefined)).toEqual({});
  });
});

describe("Les clients Supabase en production", () => {
  it("le client serveur demande des cookies secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await clientServeur();
    expect(derniere(capture.serveur)).toEqual({ secure: true });
  });

  it("le proxy, qui renouvelle la session, aussi", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await proxy(new NextRequest("https://etudium.online/formations"));
    expect(derniere(capture.serveur)).toEqual({ secure: true });
  });

  it("le client du navigateur aussi", () => {
    vi.stubEnv("NODE_ENV", "production");
    clientNavigateur();
    expect(derniere(capture.navigateur)).toEqual({ secure: true });
  });

  it("en développement, les cookies restent lisibles sur http://localhost", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await clientServeur();
    expect(derniere(capture.serveur).secure).toBeUndefined();
  });
});

describe("« Se souvenir de moi » garde secure, sameSite et path", () => {
  const deSupabase = { path: "/", sameSite: "lax" as const, httpOnly: false, maxAge: 400 * 24 * 60 * 60, secure: true };

  it("coché : 30 jours, secure conservé", () => {
    expect(withRememberChoice(deSupabase, true)).toEqual({ path: "/", sameSite: "lax", httpOnly: false, secure: true, maxAge: TRENTE_JOURS });
  });

  it("décoché : cookie de session, secure conservé", () => {
    expect(withRememberChoice(deSupabase, false)).toEqual({ path: "/", sameSite: "lax", httpOnly: false, secure: true });
  });
});
