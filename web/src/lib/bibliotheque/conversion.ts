import type { CouleurParcours } from "@/lib/contenus/libelles";
import type {
  AccesLivre,
  BibliothequeAdmin,
  CarteLivre,
  CatalogueBibliotheque,
  CategorieLivre,
  CategorieRangee,
  EtatAccesLivre,
  FicheLivre,
  LectureLivre,
  LivreAdmin,
  ParcoursLivre,
  StatutLivre,
  TotauxBibliotheque,
} from "./types";

// La lecture des réponses de la base (migration 0074), sans accès au serveur : une valeur inattendue est ramenée à une
// valeur sûre plutôt que de casser la page.

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
const liste = (v: unknown): Brut[] => (Array.isArray(v) ? v.map(objet) : []);
const texte = (v: unknown) => (typeof v === "string" ? v : "");
const texteOuNull = (v: unknown) => (typeof v === "string" && v ? v : null);
const entier = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
};
const entierOuNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const textes = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

const STATUTS: readonly StatutLivre[] = ["brouillon", "publie", "archive"];
const ETATS_ACCES: readonly EtatAccesLivre[] = ["ouvert", "connexion", "abonnement", "ferme"];
const COULEURS: readonly CouleurParcours[] = ["academique", "digital", "business"];

const statut = (v: unknown): StatutLivre => (STATUTS.includes(v as StatutLivre) ? (v as StatutLivre) : "brouillon");
const acces = (v: unknown): AccesLivre => (v === "gratuit" ? "gratuit" : "abonnes");

function versCategorie(v: unknown): CategorieLivre | null {
  const c = objet(v);
  const id = texteOuNull(c.id);
  return id ? { id, slug: texte(c.slug), nom: texte(c.nom) } : null;
}

function versParcours(v: unknown): ParcoursLivre | null {
  const p = objet(v);
  const id = texteOuNull(p.id);
  if (!id) return null;
  return {
    id,
    slug: texte(p.slug),
    nom: texte(p.nom),
    nomCourt: texte(p.nom_court) || texte(p.nom),
    couleur: COULEURS.includes(p.couleur as CouleurParcours) ? (p.couleur as CouleurParcours) : "academique",
  };
}
const versParcoursListe = (v: unknown) =>
  liste(v)
    .map(versParcours)
    .filter((p): p is ParcoursLivre => p !== null);

/** Une ligne de livres_back_office → LivreAdmin ; null sans identifiant. */
function versLivreAdmin(v: unknown): LivreAdmin | null {
  const l = objet(v);
  const id = texteOuNull(l.id);
  if (!id) return null;
  return {
    id,
    slug: texte(l.slug),
    titre: texte(l.titre),
    auteur: texte(l.auteur),
    resume: texte(l.resume),
    langue: texte(l.langue) || "fr",
    annee: entierOuNull(l.annee),
    motsCles: textes(l.mots_cles),
    nbPages: entierOuNull(l.nb_pages),
    categorie: versCategorie(l.categorie),
    parcours: versParcoursListe(l.parcours),
    fichier: texteOuNull(l.fichier),
    tailleOctets: entierOuNull(l.taille_octets),
    couverture: texteOuNull(l.couverture),
    acces: acces(l.acces),
    telechargeable: l.telechargeable === true,
    droitsConfirmes: l.droits_confirmes === true,
    statut: statut(l.statut),
    creeLe: texteOuNull(l.cree_le),
    modifieLe: texteOuNull(l.modifie_le),
    publieLe: texteOuNull(l.publie_le),
    lectures: entier(l.lectures),
    lecturesTerminees: entier(l.lectures_terminees),
    lectures30j: entier(l.lectures_30j),
    telechargements: entier(l.telechargements),
    telechargements30j: entier(l.telechargements_30j),
    favoris: entier(l.favoris),
    formations: entier(l.formations),
  };
}

function versTotaux(v: unknown): TotauxBibliotheque {
  const t = objet(v);
  return {
    publies: entier(t.publies),
    brouillons: entier(t.brouillons),
    archives: entier(t.archives),
    lectures: entier(t.lectures),
    lectures30j: entier(t.lectures_30j),
    telechargements: entier(t.telechargements),
    telechargements30j: entier(t.telechargements_30j),
  };
}

/** livres_back_office() → BibliothequeAdmin. */
export function versBibliothequeAdmin(brut: unknown): BibliothequeAdmin {
  const b = objet(brut);
  return {
    totaux: versTotaux(b.totaux),
    livres: liste(b.livres)
      .map(versLivreAdmin)
      .filter((l): l is LivreAdmin => l !== null),
  };
}

function versLecture(v: unknown): LectureLivre | null {
  if (!v || typeof v !== "object") return null;
  const r = objet(v);
  return {
    dernierePage: Math.max(1, entier(r.derniere_page)),
    nbPages: Math.max(1, entier(r.nb_pages)),
    pourcentage: Math.min(100, entier(r.pourcentage)),
    terminee: r.terminee === true,
    ouvertLe: texteOuNull(r.ouvert_le),
    majLe: texteOuNull(r.maj_le),
  };
}

/** carte_livre (catalogue, « Continuer la lecture », favoris, recommandations) → CarteLivre ; null sans identifiant. */
export function versCarteLivre(v: unknown): CarteLivre | null {
  const l = objet(v);
  const id = texteOuNull(l.id);
  if (!id) return null;
  return {
    id,
    slug: texte(l.slug),
    titre: texte(l.titre),
    auteur: texte(l.auteur),
    resume: texte(l.resume),
    langue: texte(l.langue) || "fr",
    annee: entierOuNull(l.annee),
    motsCles: textes(l.mots_cles),
    nbPages: entierOuNull(l.nb_pages),
    couverture: texteOuNull(l.couverture),
    acces: acces(l.acces),
    telechargeable: l.telechargeable === true,
    statut: statut(l.statut),
    publieLe: texteOuNull(l.publie_le),
    categorie: versCategorie(l.categorie),
    parcours: versParcoursListe(l.parcours),
    ouvert: l.ouvert === true,
    accesEtat: ETATS_ACCES.includes(l.acces_etat as EtatAccesLivre) ? (l.acces_etat as EtatAccesLivre) : "ferme",
    favori: l.favori === true,
    lecture: versLecture(l.lecture),
  };
}

/** Une liste de cartes (mes_lectures, mes_favoris_livres, livres_formation). */
export const versCartesLivres = (brut: unknown): CarteLivre[] =>
  liste(brut)
    .map(versCarteLivre)
    .filter((c): c is CarteLivre => c !== null);

/** livre_fiche(slug) → FicheLivre ; null si le livre n'existe pas (ou n'est pas publié). */
export function versFicheLivre(brut: unknown): FicheLivre | null {
  const carte = versCarteLivre(brut);
  if (!carte) return null;
  const f = objet(brut);
  return {
    ...carte,
    tailleOctets: entierOuNull(f.taille_octets),
    modifieLe: texteOuNull(f.modifie_le),
    formations: liste(f.formations)
      .filter((x) => texteOuNull(x.id))
      .map((x) => ({ id: texte(x.id), slug: texte(x.slug), titre: texte(x.titre), couverture: texteOuNull(x.couverture) })),
  };
}

/** bibliotheque_catalogue(…) → CatalogueBibliotheque. */
export function versCatalogue(brut: unknown): CatalogueBibliotheque {
  const b = objet(brut);
  return {
    livres: versCartesLivres(b.livres),
    categories: liste(b.categories)
      .map((c) => {
        const categorie = versCategorie(c);
        return categorie ? { ...categorie, livres: entier(c.livres) } : null;
      })
      .filter((c): c is CategorieLivre & { livres: number } => c !== null),
    parcours: liste(b.parcours)
      .map((p) => {
        const parcours = versParcours(p);
        return parcours ? { ...parcours, livres: entier(p.livres) } : null;
      })
      .filter((p): p is ParcoursLivre & { livres: number } => p !== null),
  };
}

/** Les lignes de categories_livres, dans leur ordre. */
export function versCategoriesRangees(brut: unknown): CategorieRangee[] {
  return liste(brut)
    .map((c) => {
      const categorie = versCategorie(c);
      return categorie ? { ...categorie, ordre: entier(c.ordre) } : null;
    })
    .filter((c): c is CategorieRangee => c !== null)
    .sort((a, b) => a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr"));
}
