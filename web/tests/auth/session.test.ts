import { describe, expect, it } from "vitest";
import { isDemoMode, routeFor } from "@/lib/auth/routing";
import { withRememberChoice } from "@/lib/auth/session-cookies";

const TRENTE_JOURS = 30 * 24 * 60 * 60;

describe("Se souvenir de moi", () => {
  it("se souvenir garde la session 30 jours", () => {
    expect(withRememberChoice({ path: "/", maxAge: 400 * 24 * 3600 }, true)).toMatchObject({ path: "/", maxAge: TRENTE_JOURS });
  });

  it("sans se souvenir, le cookie s'efface à la fermeture du navigateur", () => {
    const options = withRememberChoice({ path: "/", maxAge: 400 * 24 * 3600, expires: new Date(2030, 0, 1) }, false);
    expect(options).toEqual({ path: "/" });
  });

  it("une suppression reste une suppression", () => {
    expect(withRememberChoice({ path: "/", maxAge: 0 }, false)).toMatchObject({ maxAge: 0 });
    expect(withRememberChoice({ path: "/", maxAge: 0 }, true)).toMatchObject({ maxAge: 0 });
  });
});

describe("Pages protégées", () => {
  it("un visiteur est renvoyé à la connexion", () => {
    expect(routeFor({ pathname: "/certificats", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fcertificats" });
    expect(routeFor({ pathname: "/mes-formations/excel", signedIn: false, hadSession: false })).toEqual({
      redirect: "/connexion?next=%2Fmes-formations%2Fexcel",
    });
  });

  it("une session expirée l'annonce", () => {
    expect(routeFor({ pathname: "/accueil", signedIn: false, hadSession: true })).toEqual({ redirect: "/connexion?session=expiree" });
  });

  it("un compte connecté ne revoit pas la connexion", () => {
    for (const pathname of ["/connexion", "/inscription", "/verification-email", "/mot-de-passe-oublie"]) {
      expect(routeFor({ pathname, signedIn: true, hadSession: true })).toEqual({ redirect: "/accueil" });
    }
  });

  it("la racine oriente", () => {
    expect(routeFor({ pathname: "/", signedIn: true, hadSession: true })).toEqual({ redirect: "/accueil" });
    expect(routeFor({ pathname: "/", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion" });
  });

  it("la vitrine, l'état et les retours d'e-mail restent ouverts", () => {
    for (const pathname of ["/vitrine", "/etat", "/auth/confirm", "/auth/callback", "/nouveau-mot-de-passe", "/conditions"]) {
      expect(routeFor({ pathname, signedIn: false, hadSession: false })).toEqual({});
    }
    expect(routeFor({ pathname: "/accueil", signedIn: true, hadSession: true })).toEqual({});
  });
});

describe("Mode démonstration", () => {
  it("seulement en développement et tant que la base n'est pas configurée", () => {
    expect(isDemoMode({ configured: false, nodeEnv: "development" })).toBe(true);
    expect(isDemoMode({ configured: true, nodeEnv: "development" })).toBe(false);
    expect(isDemoMode({ configured: false, nodeEnv: "production" })).toBe(false);
    expect(isDemoMode({ configured: false, nodeEnv: "test" })).toBe(false);
  });
});
