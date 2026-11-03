import type { TagTone } from "@/components/ui/Tag";
import type { AccesLivre, ChampLivre, SaisieLivre, StatutLivre } from "./types";

// Les règles de la Bibliothèque communes au navigateur et au serveur (migration 0074 : la base revérifie tout).

/** 50 Mo : la limite d'un fichier de l'offre gratuite de Supabase, et celle de l'espace « bibliotheque ». */
export const LIVRE_MAX_OCTETS = 52_428_800;
export const TYPE_PDF = "application/pdf";
export const ESPACE_LIVRES = "bibliotheque";

export const PDF_REFUSE = "Choisissez un fichier PDF.";
export const PDF_TROP_LOURD = "Ce fichier dépasse 50 Mo.";

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
