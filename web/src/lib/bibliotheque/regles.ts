import type { TagTone } from "@/components/ui/Tag";
import { sansAccents } from "@/lib/catalogue/filtres";
import type { AccesLivre, CarteLivre, ChampLivre, LectureLivre, SaisieLivre, StatutLivre } from "./types";

// Les règles de la Bibliothèque communes au navigateur et au serveur (migration 0074 : la base revérifie tout).

/** 50 Mo : la limite d'un fichier de l'offre gratuite de Supabase, et celle de l'espace « bibliotheque ». */
export const LIVRE_MAX_OCTETS = 52_428_800;
export const TYPE_PDF = "application/pdf";
export const ESPACE_LIVRES = "bibliotheque";

export const PDF_REFUSE = "Choisissez un fichier PDF.";
export const PDF_TROP_LOURD = "Ce fichier dépasse 50 Mo.";

/** Le filtre de la page Bibliothèque du back-office (« ?etat=… »), lu par la page serveur et par la vue. */
export type FiltreLivres = "tous" | StatutLivre;
const FILTRES_LIVRES: readonly FiltreLivres[] = ["tous", "publie", "brouillon", "archive"];
export const estFiltreLivres = (v: unknown): v is FiltreLivres => FILTRES_LIVRES.some((f) => f === v);

/** Le guide à suivre quand la base n'a pas encore la Bibliothèque (texte pour l'équipe seulement). */
export const MIGRATION_BIBLIOTHEQUE = "Appliquez la migration 0074 (guide « Ce qui te revient », section 73).";

const estPdf = (octets: Uint8Array) => [0x25, 0x50, 0x44, 0x46].every((o, i) => octets[i] === o);

/** Contrôle avant l'envoi : un vrai PDF (« %PDF » au début, quel que soit son nom), puis le poids. */
export function verifierPdf(fichier: { name: string; size: number }, octets: Uint8Array): { ok: true } | { ok: false; erreur: string } {
  if (!estPdf(octets)) return { ok: false, erreur: PDF_REFUSE };
  if (fichier.size > LIVRE_MAX_OCTETS) return { ok: false, erreur: PDF_TROP_LOURD };
  return { ok: true };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const estUuid = (v: unknown): v is string => typeof v === "string" && new RegExp(`^${UUID}$`, "i").test(v);

/** Le PDF directement dans le dossier du livre : `<id>/<uuid>.pdf`. */
export const cheminPdfValide = (livreId: string, chemin: string) => estUuid(livreId) && new RegExp(`^${livreId}/${UUID}\\.pdf$`, "i").test(chemin);
/** La couverture dans l'espace public « couvertures » : `livres/<id>/<uuid>.<jpg|png|webp>`. */
export const cheminCouvertureValide = (livreId: string, chemin: string) =>
  estUuid(livreId) && new RegExp(`^livres/${livreId}/${UUID}\\.(jpg|png|webp)$`, "i").test(chemin);

// ─── Libellés ───────────────────────────────────────────────────────────────────────────────────────

export const ETATS_LIVRE: Record<StatutLivre, string> = { brouillon: "Brouillon", publie: "Publié", archive: "Archivé" };
export const TON_ETAT_LIVRE: Record<StatutLivre, TagTone> = { brouillon: "enAttente", publie: "valide", archive: "aCorriger" };
export const LIBELLES_ACCES: Record<AccesLivre, string> = { gratuit: "Gratuit", abonnes: "Inclus dans l’abonnement" };
export const TON_ACCES: Record<AccesLivre, TagTone> = { gratuit: "gratuit", abonnes: "nouveau" };

/** Les langues proposées (code à deux lettres, comme la base). */
export const LANGUES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "es", label: "Espagnol" },
  { value: "pt", label: "Portugais" },
  { value: "de", label: "Allemand" },
  { value: "ar", label: "Arabe" },
];
export const nomLangue = (code: string) => LANGUES.find((l) => l.value === code)?.label ?? code;

/** « 1 page », « 120 pages ». */
export const pages = (n: number) => `${n.toLocaleString("fr-FR")} page${n > 1 ? "s" : ""}`;

// ─── Les actions sur l'état d'un livre ──────────────────────────────────────────────────────────────

export type ActionLivre = "publier" | "archiver" | "republier" | "supprimer";

/** Un brouillon se publie ou se supprime ; publié, il s'archive ; archivé, il se republie (règles de la 0074). */
export function actionsLivre(statut: StatutLivre): ActionLivre[] {
  if (statut === "brouillon") return ["publier", "supprimer"];
  if (statut === "publie") return ["archiver"];
  return ["republier"];
}

// ─── La saisie ──────────────────────────────────────────────────────────────────────────────────────

/** Les mots-clés d'une saisie séparée par des virgules : sans vide ni doublon (majuscules comprises), 20 au plus. */
export function motsClesDe(saisie: string): string[] {
  const vus = new Set<string>();
  const mots: string[] = [];
  for (const brut of saisie.split(",")) {
    const mot = brut.trim().replace(/\s+/g, " ").slice(0, 40);
    const cle = mot.toLocaleLowerCase("fr-FR");
    if (!mot || vus.has(cle)) continue;
    vus.add(cle);
    mots.push(mot);
    if (mots.length === 20) break;
  }
  return mots;
}

export type LigneLivre = {
  titre: string;
  auteur: string;
  resume: string;
  langue: string;
  annee: number | null;
  mots_cles: string[];
  nb_pages: number | null;
  categorie_id: string | null;
  acces: AccesLivre;
  telechargeable: boolean;
  droits_confirmes: boolean;
};

const ANNEE = "Une année à quatre chiffres, par exemple 2024.";
const NB_PAGES = "Un nombre de pages entre 1 et 100 000.";

/** La saisie de la fiche, vérifiée et mise en forme pour la table livres ; ou les erreurs de chaque champ. */
export function saisieVersLigne(s: SaisieLivre): { ok: true; ligne: LigneLivre } | { ok: false; erreurs: Partial<Record<ChampLivre, string>> } {
  const erreurs: Partial<Record<ChampLivre, string>> = {};
  const titre = s.titre.trim().replace(/\s+/g, " ");
  const auteur = s.auteur.trim().replace(/\s+/g, " ");
  const resume = s.resume.trim();
  if (!titre) erreurs.titre = "Entrez le titre du livre.";
  else if (titre.length > 200) erreurs.titre = "200 caractères au maximum.";
  if (auteur.length > 120) erreurs.auteur = "120 caractères au maximum.";
  if (resume.length > 2000) erreurs.resume = "2 000 caractères au maximum.";
  if (!LANGUES.some((l) => l.value === s.langue)) erreurs.langue = "Choisissez la langue du livre.";
  const anneeSaisie = s.annee.trim();
  const annee = anneeSaisie === "" ? null : /^\d{4}$/.test(anneeSaisie) ? Number(anneeSaisie) : NaN;
  if (annee !== null && (!Number.isInteger(annee) || annee < 1000 || annee > new Date().getFullYear() + 1)) erreurs.annee = ANNEE;
  const pagesSaisies = s.nbPages.trim().replace(/\s/g, "");
  const nbPages = pagesSaisies === "" ? null : /^\d+$/.test(pagesSaisies) ? Number(pagesSaisies) : NaN;
  if (nbPages !== null && (!Number.isInteger(nbPages) || nbPages < 1 || nbPages > 100_000)) erreurs.nbPages = NB_PAGES;
  if (s.categorieId !== null && !estUuid(s.categorieId)) erreurs.categorieId = "Choisissez une catégorie de la liste.";
  if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    ligne: {
      titre,
      auteur,
      resume,
      langue: s.langue,
      annee,
      mots_cles: motsClesDe(s.motsCles),
      nb_pages: nbPages,
      categorie_id: s.categorieId,
      acces: s.acces === "gratuit" ? "gratuit" : "abonnes",
      telechargeable: s.telechargeable === true,
      droits_confirmes: s.droitsConfirmes === true,
    },
  };
}

// ─── Les pages des étudiants et des visiteurs (étapes B et C) ───────────────────────────────────────

export const adresseLivre = (slug: string) => `/bibliotheque/${slug}`;
/** Le lecteur ; `page` : l'ouvrir à cette page (« Relire » un livre terminé), sinon à la dernière page lue. */
export const adresseLecture = (slug: string, page?: number) => `/bibliotheque/${slug}/lire${page ? `?page=${page}` : ""}`;

/** Le bouton d'un livre ouvert : « Lire » la première fois, « Continuer, page N » ensuite, « Relire » un livre terminé. */
export function boutonLecture(livre: Pick<CarteLivre, "slug" | "lecture">): { libelle: string; href: string } {
  const lecture = livre.lecture;
  if (lecture?.terminee) return { libelle: "Relire", href: adresseLecture(livre.slug, 1) };
  if (lecture && lecture.dernierePage > 1) return { libelle: `Continuer, page ${lecture.dernierePage}`, href: adresseLecture(livre.slug) };
  return { libelle: "Lire", href: adresseLecture(livre.slug) };
}

/** Sur la carte d'un livre commencé : « 42 % lus », ou « Terminé » ; null s'il n'a jamais été ouvert. */
export function progressionLivre(lecture: LectureLivre | null): string | null {
  if (!lecture) return null;
  return lecture.terminee ? "Terminé" : `${lecture.pourcentage} % lus`;
}

/** Les filtres du catalogue tels qu'ils sont dans l'adresse (`?parcours=…&categorie=…&gratuits=1&q=…`). */
export type FiltresAdresseBibliotheque = { q: string; parcours: string | null; categorie: string | null; gratuits: boolean };
export const FILTRES_BIBLIOTHEQUE_VIDES: FiltresAdresseBibliotheque = { q: "", parcours: null, categorie: null, gratuits: false };

type ParamsAdresse = Record<string, string | string[] | undefined>;
const premiere = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
/** L'adresse d'un parcours ou d'une catégorie (minuscules, chiffres, tirets), sinon rien. */
const adresseOuNull = (v: string) => (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length <= 90 ? v : null);

/** Les filtres de l'adresse ; une valeur mal formée est ignorée, la recherche coupée à 100 caractères. */
export function lireFiltresBibliotheque(params: ParamsAdresse): FiltresAdresseBibliotheque {
  return {
    q: premiere(params.q).trim().slice(0, 100),
    parcours: adresseOuNull(premiere(params.parcours)),
    categorie: adresseOuNull(premiere(params.categorie)),
    gratuits: premiere(params.gratuits) === "1",
  };
}

/** « ?parcours=…&categorie=…&q=… » (ordre fixe) ; "" sans filtre. */
export function ecrireFiltresBibliotheque(f: FiltresAdresseBibliotheque): string {
  const params = new URLSearchParams();
  if (f.parcours) params.set("parcours", f.parcours);
  if (f.categorie) params.set("categorie", f.categorie);
  if (f.gratuits) params.set("gratuits", "1");
  if (f.q.trim()) params.set("q", f.q.trim());
  const texte = params.toString();
  return texte ? `?${texte}` : "";
}

export const filtresActifs = (f: FiltresAdresseBibliotheque) => Boolean(f.q.trim() || f.parcours || f.categorie || f.gratuits);

/**
 * Les livres qui répondent aux filtres, dans leur ordre (les plus récents d'abord) : le catalogue est lu une fois, puis
 * filtré dans le navigateur, comme celui des formations. La recherche suit celle de la base (titre, auteur, mots-clés,
 * sans accents ni majuscules), chaque mot devant y être.
 */
export function filtrerLivres(livres: CarteLivre[], f: FiltresAdresseBibliotheque): CarteLivre[] {
  const mots = sansAccents(f.q).split(/\s+/).filter(Boolean);
  return livres.filter((l) => {
    if (f.gratuits && l.acces !== "gratuit") return false;
    if (f.parcours && !l.parcours.some((p) => p.slug === f.parcours)) return false;
    if (f.categorie && l.categorie?.slug !== f.categorie) return false;
    if (mots.length === 0) return true;
    const cible = sansAccents([l.titre, l.auteur, ...l.motsCles].join(" "));
    return mots.every((mot) => cible.includes(mot));
  });
}

// ─── Le lecteur ─────────────────────────────────────────────────────────────────────────────────────

export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 3;
/** Les crans des boutons « Réduire » et « Agrandir » (1 : la page à la largeur de l'écran). */
export const CRANS_ZOOM = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

/** Le zoom après un pincement : celui du départ, multiplié par l'écart des doigts, au vingtième, entre 50 % et 300 %. */
export function zoomApresPincement(zoomDepart: number, ecartDepart: number, ecart: number): number {
  if (ecartDepart <= 0) return zoomDepart;
  const zoom = Math.round(((zoomDepart * ecart) / ecartDepart) * 20) / 20;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
}
