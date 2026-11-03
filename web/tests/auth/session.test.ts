import { describe, expect, it } from "vitest";
import { hasSessionCookie, isDemoMode, routeFor } from "@/lib/auth/routing";
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
  it("une session expirée garde la page demandée", () => {
    expect(routeFor({ pathname: "/certificats", signedIn: false, hadSession: true })).toEqual({ redirect: "/connexion?session=expiree&next=%2Fcertificats" });
  });

  it("une route d'API n'est jamais renvoyée vers la connexion : elle répond elle-même (401)", () => {
    // Sinon, une session expirée recevrait la page de connexion (HTML, statut 200) et la prendrait pour une réussite.
    expect(routeFor({ pathname: "/api/visionnage", signedIn: false, hadSession: true })).toEqual({});
    expect(routeFor({ pathname: "/api/visionnage", signedIn: false, hadSession: false })).toEqual({});
    expect(routeFor({ pathname: "/apiculture", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fapiculture" });
  });

  it("le cookie d'une connexion Google abandonnée n'est pas une session", () => {
    expect(hasSessionCookie(["sb-projet-auth-token-code-verifier"])).toBe(false);
    expect(hasSessionCookie(["sb-projet-auth-token"])).toBe(true);
    expect(hasSessionCookie(["sb-projet-auth-token.0", "sb-projet-auth-token.1"])).toBe(true);
  });

  it("une page de l'espace connecté non listée est protégée d'office", () => {
    expect(routeFor({ pathname: "/nouvelle-page", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fnouvelle-page" });
    expect(routeFor({ pathname: "/admin", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fadmin" });
    expect(routeFor({ pathname: "/formateur/cours", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fformateur%2Fcours" });
  });

  it("les pages publiques restent ouvertes sans compte", () => {
    // Liste écrite en toutes lettres (et non relue dans PAGES_PUBLIQUES) : si l'une d'elles sortait de la liste,
    // la connexion elle-même deviendrait inaccessible et tournerait en rond.
    const publiques = [
      "/connexion",
      "/inscription",
      "/verification-email",
      "/mot-de-passe-oublie",
      "/nouveau-mot-de-passe",
      "/conditions",
      "/confidentialite",
      "/etat",
      "/auth/callback",
      "/auth/confirm",
    ];
    for (const pathname of publiques) {
      expect(routeFor({ pathname, signedIn: false, hadSession: false }), pathname).toEqual({});
    }
  });

  it("la vérification d'un certificat est ouverte sans compte (QR Code) ; la page Certificats ne l'est pas", () => {
    for (const pathname of ["/verifier", "/c/ET-2026-K7Q2-M9XD"]) expect(routeFor({ pathname, signedIn: false, hadSession: false }), pathname).toEqual({});
    expect(routeFor({ pathname: "/certificats", signedIn: false, hadSession: false })).not.toEqual({});
    expect(routeFor({ pathname: "/certificats/ET-2026-K7Q2-M9XD/pdf", signedIn: false, hadSession: false })).not.toEqual({});
  });

  it("une redirection ne mène jamais vers une page elle-même protégée", () => {
    for (const pathname of ["/", "/accueil", "/admin", "/nouvelle-page"]) {
      for (const hadSession of [false, true]) {
        const { redirect } = routeFor({ pathname, signedIn: false, hadSession });
        const cible = new URL(redirect ?? "/connexion", "http://etudium.invalid").pathname;
        expect(routeFor({ pathname: cible, signedIn: false, hadSession }), `${pathname} → ${cible}`).toEqual({});
      }
    }
  });

  it("un visiteur est renvoyé à la connexion", () => {
    expect(routeFor({ pathname: "/certificats", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fcertificats" });
    expect(routeFor({ pathname: "/mes-formations/excel", signedIn: false, hadSession: false })).toEqual({
      redirect: "/connexion?next=%2Fmes-formations%2Fexcel",
    });
  });

  it("une session expirée l'annonce", () => {
    expect(routeFor({ pathname: "/accueil", signedIn: false, hadSession: true })).toEqual({ redirect: "/connexion?session=expiree&next=%2Faccueil" });
  });

  it("un compte connecté ne revoit pas la connexion", () => {
    for (const pathname of ["/connexion", "/inscription", "/verification-email", "/mot-de-passe-oublie"]) {
      expect(routeFor({ pathname, signedIn: true, hadSession: true })).toEqual({ redirect: "/accueil" });
    }
  });

  it("la racine montre la landing à tous, compte connecté compris (demande du 3 novembre 2026)", () => {
    expect(routeFor({ pathname: "/", signedIn: true, hadSession: true })).toEqual({});
    expect(routeFor({ pathname: "/", signedIn: false, hadSession: false })).toEqual({});
    expect(routeFor({ pathname: "/", signedIn: false, hadSession: true })).toEqual({});
  });

  it("la vitrine, l'état et les retours d'e-mail restent ouverts", () => {
    for (const pathname of ["/vitrine", "/etat", "/auth/confirm", "/auth/callback", "/nouveau-mot-de-passe", "/conditions"]) {
      expect(routeFor({ pathname, signedIn: false, hadSession: false })).toEqual({});
    }
    expect(routeFor({ pathname: "/accueil", signedIn: true, hadSession: true })).toEqual({});
  });

  it("le catalogue, les fiches et leur image de partage s'ouvrent sans compte (spec du lot 1, §2)", () => {
    for (const pathname of ["/formations", "/formations/maitriser-microsoft-excel", "/formations/maitriser-microsoft-excel/opengraph-image"]) {
      expect(routeFor({ pathname, signedIn: false, hadSession: false }), pathname).toEqual({});
      expect(routeFor({ pathname, signedIn: true, hadSession: true }), pathname).toEqual({});
    }
  });

  it("le profil d'un formateur s'ouvre sans compte ; l'espace formateur reste fermé (spec du 2 novembre 2026, §6)", () => {
    const profil = "/formateurs/11111111-1111-4111-8111-111111111111";
    expect(routeFor({ pathname: profil, signedIn: false, hadSession: false })).toEqual({});
    expect(routeFor({ pathname: profil, signedIn: true, hadSession: true })).toEqual({});
    expect(routeFor({ pathname: "/formateur", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fformateur" });
    expect(routeFor({ pathname: "/formateur/formations", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fformateur%2Fformations" });
  });

  it("les formations gratuites restent dans l'espace connecté", () => {
    expect(routeFor({ pathname: "/formations-gratuites", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fformations-gratuites" });
  });

  it("le lien de réinitialisation ouvre une session : le nouveau mot de passe reste accessible", () => {
    expect(routeFor({ pathname: "/nouveau-mot-de-passe", signedIn: true, hadSession: true })).toEqual({});
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
