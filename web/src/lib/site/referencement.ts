import type { MetadataRoute } from "next";
import type { FormationDuPlan, LivreDuPlan } from "@/lib/catalogue/plan-du-site";

// Ce que voient les moteurs de recherche (spec de la mise en ligne, §1.2) : robots.txt (src/app/robots.ts) et
// sitemap.xml (src/app/sitemap.ts). Une page ajoutée dans src/app doit être rangée ici : le test
// tests/site/referencement.test.ts le rappelle.

/**
 * Permis. La règle la plus longue l'emporte (RFC 9309, Google, Bing) : « /formateurs/ » (profils publics) passe avant
 * « /formateur » (l'espace formateur), qui en est le début.
 */
export const CHEMINS_OUVERTS = ["/", "/formateurs/"];

/** Fermé aux moteurs (« * » : n'importe quelle suite de caractères). */
export const CHEMINS_FERMES = [
  // Back-office, espace formateur, routes d'API.
  "/admin",
  "/formateur",
  "/api/",
  // L'espace connecté de l'étudiant.
  "/abonnement",
  "/accueil",
  "/aide",
  "/certificats",
  "/communaute",
  "/evenements",
  "/exercices",
  "/favoris",
  "/formations-gratuites",
  "/groupes",
  "/menu",
  "/mes-formations",
  "/messages",
  "/notifications",
  "/parcours",
  "/profil",
  "/recherche",
  "/tableau-de-bord",
  // Les leçons et la validation d'une formation (pour les inscrits) ; un certificat porte le nom de son titulaire.
  "/formations/*/lecons/",
  "/formations/*/validation",
  // Le lecteur d'un livre (pour les comptes qui ont l'accès) : la fiche du livre est la page à référencer.
  "/bibliotheque/*/lire",
  "/c/",
  // Compte et authentification ; pages techniques.
  "/connexion",
  "/inscription",
  "/verification-email",
  "/mot-de-passe-oublie",
  "/nouveau-mot-de-passe",
  "/auth/",
  "/etat",
  "/vitrine",
];

/** Les pages publiques fixes du plan du site (« /parcours » est dans l'espace connecté ; il n'y a pas de « /tarifs »). */
const PAGES_FIXES = ["", "/formations", "/bibliotheque"];

/** La date la plus récente d'une formation : sa dernière modification, sinon sa publication. */
const dateDe = (f: FormationDuPlan) => f.modifieLe ?? f.publieeLe ?? undefined;
const plusRecente = (dates: (string | undefined)[]) =>
  dates.filter((d): d is string => Boolean(d)).sort((a, b) => Date.parse(b) - Date.parse(a))[0];

/**
 * Le plan du site : l'accueil, le catalogue, la Bibliothèque, la fiche de chaque formation publiée, le profil de chaque
 * formateur qui en a au moins une, et la fiche de chaque livre publié. Sans formation ni livre (démonstration, lecture
 * impossible) : les pages fixes seulement.
 */
export function planDuSite(site: string, formations: FormationDuPlan[], livres: LivreDuPlan[] = []): MetadataRoute.Sitemap {
  const derniere = plusRecente(formations.map(dateDe));
  const dates: Record<string, string | undefined> = { "/formations": derniere, "/bibliotheque": plusRecente(livres.map((l) => l.publieLe ?? undefined)) };
  const fixes = PAGES_FIXES.map((chemin) => {
    const date = dates[chemin];
    return { url: `${site}${chemin}`, ...(date ? { lastModified: date } : {}) };
  });
  const fiches = formations
    .filter((f) => f.slug)
    .map((f) => {
      const date = dateDe(f);
      return { url: `${site}/formations/${f.slug}`, ...(date ? { lastModified: date } : {}) };
    });
  const parFormateur = new Map<string, (string | undefined)[]>();
  for (const f of formations) {
    if (f.formateurId) parFormateur.set(f.formateurId, [...(parFormateur.get(f.formateurId) ?? []), dateDe(f)]);
  }
  const formateurs = [...parFormateur].map(([id, dates]) => {
    const date = plusRecente(dates);
    return { url: `${site}/formateurs/${id}`, ...(date ? { lastModified: date } : {}) };
  });
  const fichesLivres = livres
    .filter((l) => l.slug)
    .map((l) => ({ url: `${site}/bibliotheque/${l.slug}`, ...(l.publieLe ? { lastModified: l.publieLe } : {}) }));
  return [...fixes, ...fiches, ...formateurs, ...fichesLivres];
}
