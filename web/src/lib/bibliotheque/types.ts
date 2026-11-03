import type { CouleurParcours } from "@/lib/contenus/libelles";

// La Bibliothèque numérique (spec du 3 novembre 2026 ; migration 0074). Les formes lues dans la base, déjà converties
// (src/lib/bibliotheque/conversion.ts) : le back-office (étape A), et ce qu'il faut aux pages des étudiants (étapes B, C).

export type StatutLivre = "brouillon" | "publie" | "archive";
export type AccesLivre = "gratuit" | "abonnes";
/** Le bouton de la fiche : « Lire » (ouvert), « Se connecter » (connexion), « Voir les abonnements » (abonnement). */
export type EtatAccesLivre = "ouvert" | "connexion" | "abonnement" | "ferme";

export type CategorieLivre = { id: string; slug: string; nom: string };
export type CategorieRangee = CategorieLivre & { ordre: number };
export type ParcoursLivre = { id: string; slug: string; nom: string; nomCourt: string; couleur: CouleurParcours };

// ─── Back-office (livres_back_office) ───────────────────────────────────────────────────────────────

export type LivreAdmin = {
  id: string;
  slug: string;
  titre: string;
  auteur: string;
  resume: string;
  langue: string;
  annee: number | null;
  motsCles: string[];
  nbPages: number | null;
  categorie: CategorieLivre | null;
  parcours: ParcoursLivre[];
  /** Le chemin du PDF dans l'espace privé « bibliotheque » ; null : pas encore de fichier. */
  fichier: string | null;
  tailleOctets: number | null;
  /** Le chemin de la couverture dans l'espace public « couvertures » (livres/<id>/…). */
  couverture: string | null;
  acces: AccesLivre;
  telechargeable: boolean;
  droitsConfirmes: boolean;
  statut: StatutLivre;
  creeLe: string | null;
  modifieLe: string | null;
  publieLe: string | null;
  lectures: number;
  lecturesTerminees: number;
  lectures30j: number;
  telechargements: number;
  telechargements30j: number;
  favoris: number;
  formations: number;
};

export type TotauxBibliotheque = {
  publies: number;
  brouillons: number;
  archives: number;
  lectures: number;
  lectures30j: number;
  telechargements: number;
  telechargements30j: number;
};

export type BibliothequeAdmin = { totaux: TotauxBibliotheque; livres: LivreAdmin[] };

/** Un livre recommandé par une formation, vu du back-office (fiche de la formation). */
export type LivreRecommande = { id: string; titre: string; auteur: string; statut: StatutLivre; couverture: string | null };

/** Ce que la fiche d'un livre envoie à l'enregistrement (après le dépôt des fichiers par le navigateur). */
export type SaisieLivre = {
  /** L'identifiant du livre, choisi par le navigateur pour un nouveau livre (le dossier de ses fichiers). */
  id: string;
  nouveau: boolean;
  titre: string;
  auteur: string;
  resume: string;
  langue: string;
  /** L'année saisie, ou "". */
  annee: string;
  /** Séparés par des virgules. */
  motsCles: string;
  /** Lu dans le PDF, ou saisi ; "" : inconnu. */
  nbPages: string;
  categorieId: string | null;
  parcours: string[];
  acces: AccesLivre;
  telechargeable: boolean;
  droitsConfirmes: boolean;
  /** Un PDF déposé pendant cette saisie (sinon, celui du livre ne change pas). */
  fichier?: { chemin: string; tailleOctets: number } | null;
  /** Une couverture déposée (chemin), retirée (null), ou inchangée (absente). */
  couverture?: string | null;
};

export type ResultatLivre = { ok: true; id: string } | { ok: false; message?: string; erreurs?: Partial<Record<ChampLivre, string>> };
export type ChampLivre = "titre" | "auteur" | "resume" | "langue" | "annee" | "motsCles" | "nbPages" | "categorieId" | "fichier" | "droitsConfirmes";

// ─── Étudiants et visiteurs (étapes B et C) ─────────────────────────────────────────────────────────

export type LectureLivre = { dernierePage: number; nbPages: number; pourcentage: number; terminee: boolean; ouvertLe: string | null; majLe: string | null };

/** La carte d'un livre (carte_livre) : catalogue, « Continuer la lecture », favoris, recommandations. */
export type CarteLivre = {
  id: string;
  slug: string;
  titre: string;
  auteur: string;
  resume: string;
  langue: string;
  annee: number | null;
  motsCles: string[];
  nbPages: number | null;
  couverture: string | null;
  acces: AccesLivre;
  telechargeable: boolean;
  statut: StatutLivre;
  publieLe: string | null;
  categorie: CategorieLivre | null;
  parcours: ParcoursLivre[];
  /** Le compte qui demande peut le lire (acces_livre). */
  ouvert: boolean;
  accesEtat: EtatAccesLivre;
  favori: boolean;
  /** Sa lecture par le compte qui demande ; null : jamais ouvert. */
  lecture: LectureLivre | null;
};

/** La fiche d'un livre (livre_fiche) : la carte, sa taille et les formations publiées qui le recommandent. */
export type FicheLivre = CarteLivre & {
  tailleOctets: number | null;
  modifieLe: string | null;
  formations: { id: string; slug: string; titre: string; couverture: string | null }[];
};

export type CatalogueBibliotheque = {
  livres: CarteLivre[];
  categories: (CategorieLivre & { livres: number })[];
  parcours: (ParcoursLivre & { livres: number })[];
};

/** Les filtres du catalogue (bibliotheque_catalogue) : recherche, adresse d'un parcours, d'une catégorie, gratuits. */
export type FiltresBibliotheque = { recherche?: string; parcours?: string | null; categorie?: string | null; gratuits?: boolean };
