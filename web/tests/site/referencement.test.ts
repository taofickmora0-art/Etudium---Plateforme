import { readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// robots.txt et sitemap.xml (spec de la mise en ligne, §1.2) : les moteurs voient le site public, jamais l'espace
// connecté, le back-office, l'espace formateur, les routes d'API ni les pages de compte.
const listFormationsDuPlan = vi.hoisted(() => vi.fn());
const listLivresDuPlan = vi.hoisted(() => vi.fn());
const connection = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/catalogue/plan-du-site", () => ({ listFormationsDuPlan, listLivresDuPlan }));
// connection() : le plan du site est rendu à la requête ; hors d'une requête de Next (ici), elle lèverait.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection }));

const { default: robots } = await import("@/app/robots");
const { default: sitemap } = await import("@/app/sitemap");

const SITE = "https://etudium.online";
const FORMATEUR = "a1b2c3d4-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", `${SITE}/`);
  listFormationsDuPlan.mockReset();
  listLivresDuPlan.mockReset().mockResolvedValue([]);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const regles = () => {
  const { rules } = robots();
  const regle = Array.isArray(rules) ? rules[0] : rules;
  const enListe = (v: string | string[] | undefined) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
  return { userAgent: regle.userAgent, allow: enListe(regle.allow), disallow: enListe(regle.disallow) };
};

/** Lecture d'un robots.txt selon la RFC 9309 : la règle la plus longue qui correspond l'emporte, Allow à égalité. */
function bloque(chemin: string): boolean {
  const { allow, disallow } = regles();
  const motif = (regle: string) => new RegExp(`^${regle.split("*").map((p) => p.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*")}`);
  const plusLongue = (liste: string[]) => Math.max(-1, ...liste.filter((r) => motif(r).test(chemin)).map((r) => r.length));
  return plusLongue(disallow) > plusLongue(allow);
}

/** Les adresses de toutes les pages et routes de src/app (groupes retirés, segments dynamiques remplacés). */
function adressesDeLAppli(): string[] {
  const APP = join(process.cwd(), "src", "app");
  const fichiers = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return fichiers(chemin);
      return /^(page\.tsx|route\.ts)$/.test(nom) ? [chemin] : [];
    });
  return fichiers(APP).map((fichier) => {
    const segments = relative(APP, fichier)
      .split(sep)
      .slice(0, -1)
      .filter((s) => !/^\(.+\)$/.test(s))
      .map((s) => (/^\[.+\]$/.test(s) ? "exemple" : s));
    return `/${segments.join("/")}`;
  });
}

describe("robots.txt", () => {
  it("permet tout aux moteurs et annonce le plan du site", () => {
    const { userAgent, allow } = regles();
    expect(userAgent).toBe("*");
    expect(allow).toContain("/");
    expect(robots().sitemap).toBe(`${SITE}/sitemap.xml`);
  });

  it("ferme le back-office, l'espace formateur, l'API, l'espace connecté et les pages de compte", () => {
    for (const chemin of [
      "/admin",
      "/admin/formations",
      "/formateur",
      "/formateur/formations/x",
      "/api/envois/vider",
      "/accueil",
      "/tableau-de-bord",
      "/mes-formations",
      "/formations-gratuites",
      "/parcours",
      "/profil",
      "/abonnement/souscrire",
      "/connexion",
      "/inscription",
      "/verification-email",
      "/mot-de-passe-oublie",
      "/nouveau-mot-de-passe",
      "/auth/callback",
      "/formations/excel/lecons/123",
      "/formations/excel/validation",
      // Le lecteur d'un livre (réservé aux comptes qui ont l'accès) : la fiche est la page à référencer.
      "/bibliotheque/reussir-son-memoire/lire",
    ]) {
      expect(bloque(chemin), chemin).toBe(true);
    }
  });

  it("laisse ouvertes les pages publiques (dont le profil des formateurs, malgré « /formateur »)", () => {
    for (const chemin of [
      "/",
      "/formations",
      "/formations/maitriser-excel",
      `/formateurs/${FORMATEUR}`,
      "/bibliotheque",
      "/bibliotheque/reussir-son-memoire",
      "/verifier",
      "/conditions",
      "/confidentialite",
    ]) {
      expect(bloque(chemin), chemin).toBe(false);
    }
  });

  it("chaque page de l'appli est rangée : publique et ouverte, ou fermée aux moteurs", () => {
    const OUVERTES = new Set([
      "/",
      "/formations",
      "/formations/exemple",
      "/formateurs/exemple",
      "/bibliotheque",
      "/bibliotheque/exemple",
      "/verifier",
      "/conditions",
      "/confidentialite",
    ]);
    const adresses = adressesDeLAppli();
    expect(adresses.length).toBeGreaterThan(50);
    for (const adresse of adresses) {
      expect(bloque(adresse), `${adresse} : à ranger dans src/lib/site/referencement.ts`).toBe(!OUVERTES.has(adresse));
    }
  });
});

describe("sitemap.xml", () => {
  const FORMATIONS = [
    { slug: "maitriser-excel", publieeLe: "2026-09-01T08:00:00Z", modifieLe: "2026-10-20T10:00:00Z", formateurId: FORMATEUR },
    { slug: "python-debutant", publieeLe: "2026-09-15T08:00:00Z", modifieLe: null, formateurId: FORMATEUR },
    { slug: "prise-de-parole", publieeLe: null, modifieLe: null, formateurId: null },
  ];

  it("les pages fixes, les fiches des formations publiées et les profils de leurs formateurs", async () => {
    listFormationsDuPlan.mockResolvedValue(FORMATIONS);
    const plan = await sitemap();
    expect(connection).toHaveBeenCalled();
    expect(plan.map((e) => e.url)).toEqual([
      SITE,
      `${SITE}/formations`,
      `${SITE}/bibliotheque`,
      `${SITE}/formations/maitriser-excel`,
      `${SITE}/formations/python-debutant`,
      `${SITE}/formations/prise-de-parole`,
      `${SITE}/formateurs/${FORMATEUR}`,
    ]);
  });

  it("les dates viennent de modifie_le, sinon de publiee_le ; le formateur prend celle de sa dernière formation", async () => {
    listFormationsDuPlan.mockResolvedValue(FORMATIONS);
    const plan = await sitemap();
    const date = (url: string) => plan.find((e) => e.url === url)?.lastModified;
    expect(date(`${SITE}/formations/maitriser-excel`)).toBe("2026-10-20T10:00:00Z");
    expect(date(`${SITE}/formations/python-debutant`)).toBe("2026-09-15T08:00:00Z");
    expect(date(`${SITE}/formations/prise-de-parole`)).toBeUndefined();
    expect(date(`${SITE}/formateurs/${FORMATEUR}`)).toBe("2026-10-20T10:00:00Z");
    expect(date(`${SITE}/formations`)).toBe("2026-10-20T10:00:00Z");
  });

  it("sans base (démonstration) : seulement les pages fixes", async () => {
    listFormationsDuPlan.mockResolvedValue([]);
    expect((await sitemap()).map((e) => e.url)).toEqual([SITE, `${SITE}/formations`, `${SITE}/bibliotheque`]);
  });

  it("si la lecture échoue : seulement les pages fixes", async () => {
    listFormationsDuPlan.mockRejectedValue(new Error("Base injoignable"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await sitemap()).map((e) => e.url)).toEqual([SITE, `${SITE}/formations`, `${SITE}/bibliotheque`]);
    erreur.mockRestore();
  });

  it("les fiches des livres publiés, datées de leur publication ; « /bibliotheque » prend la plus récente", async () => {
    listFormationsDuPlan.mockResolvedValue(FORMATIONS);
    listLivresDuPlan.mockResolvedValue([
      { slug: "reussir-son-memoire", publieLe: "2026-11-02T08:00:00Z" },
      { slug: "guide-excel", publieLe: null },
    ]);
    const plan = await sitemap();
    expect(plan.map((e) => e.url)).toEqual([
      SITE,
      `${SITE}/formations`,
      `${SITE}/bibliotheque`,
      `${SITE}/formations/maitriser-excel`,
      `${SITE}/formations/python-debutant`,
      `${SITE}/formations/prise-de-parole`,
      `${SITE}/formateurs/${FORMATEUR}`,
      `${SITE}/bibliotheque/reussir-son-memoire`,
      `${SITE}/bibliotheque/guide-excel`,
    ]);
    const date = (url: string) => plan.find((e) => e.url === url)?.lastModified;
    expect(date(`${SITE}/bibliotheque/reussir-son-memoire`)).toBe("2026-11-02T08:00:00Z");
    expect(date(`${SITE}/bibliotheque/guide-excel`)).toBeUndefined();
    expect(date(`${SITE}/bibliotheque`)).toBe("2026-11-02T08:00:00Z");
    for (const { url } of plan) expect(bloque(new URL(url).pathname), url).toBe(false);
  });

  it("des livres illisibles n'empêchent pas les formations d'être dans le plan", async () => {
    listFormationsDuPlan.mockResolvedValue(FORMATIONS);
    listLivresDuPlan.mockRejectedValue(new Error("Base injoignable"));
    const erreur = vi.spyOn(console, "error").mockImplementation(() => {});
    const urls = (await sitemap()).map((e) => e.url);
    expect(urls).toContain(`${SITE}/formations/maitriser-excel`);
    expect(urls.filter((u) => u.includes("/bibliotheque/"))).toEqual([]);
    erreur.mockRestore();
  });

  it("aucune page du plan n'est fermée par robots.txt", async () => {
    listFormationsDuPlan.mockResolvedValue(FORMATIONS);
    for (const { url } of await sitemap()) {
      expect(bloque(new URL(url).pathname), url).toBe(false);
    }
  });
});
