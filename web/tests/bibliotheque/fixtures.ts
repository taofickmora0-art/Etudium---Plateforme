import type { CarteLivre, CatalogueBibliotheque, FicheLivre, LectureLivre } from "@/lib/bibliotheque/types";

// Des livres pour les tests des pages de la Bibliothèque (étapes B et C), tels que les donne la conversion des réponses
// de la base (src/lib/bibliotheque/conversion.ts).

export const ID_MEMOIRE = "11111111-1111-4111-8111-111111111111";
export const ID_VENDRE = "22222222-2222-4222-8222-222222222222";
export const ID_EXCEL = "33333333-3333-4333-8333-333333333333";

export const BUSINESS = { id: "p3", slug: "business", nom: "Business en ligne", nomCourt: "Business", couleur: "business" as const };
export const ACADEMIQUE = { id: "p1", slug: "reussite-academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique" as const };
export const METHODES = { id: "c1", slug: "methodes", nom: "Méthodes de travail" };
export const OUTILS = { id: "c2", slug: "outils", nom: "Outils numériques" };

export const lecture = (o: Partial<LectureLivre> = {}): LectureLivre => ({
  dernierePage: 42,
  nbPages: 100,
  pourcentage: 42,
  terminee: false,
  ouvertLe: "2026-11-01T10:00:00Z",
  majLe: "2026-11-02T10:00:00Z",
  ...o,
});

export function carteLivre(o: Partial<CarteLivre> = {}): CarteLivre {
  return {
    id: ID_MEMOIRE,
    slug: "reussir-son-memoire",
    titre: "Réussir son mémoire",
    auteur: "Mireille Adjovi",
    resume: "Un guide pas à pas, du sujet à la soutenance.",
    langue: "fr",
    annee: 2025,
    motsCles: ["méthodologie", "mémoire"],
    nbPages: 120,
    couverture: null,
    acces: "abonnes",
    telechargeable: false,
    statut: "publie",
    publieLe: "2026-11-01T08:00:00Z",
    categorie: METHODES,
    parcours: [ACADEMIQUE],
    ouvert: true,
    accesEtat: "ouvert",
    favori: false,
    lecture: null,
    ...o,
  };
}

export const MEMOIRE = carteLivre({ lecture: lecture() });
export const VENDRE = carteLivre({
  id: ID_VENDRE,
  slug: "vendre-en-ligne",
  titre: "Vendre en ligne",
  auteur: "Koffi Mensah",
  motsCles: ["e-commerce"],
  nbPages: 80,
  acces: "gratuit",
  categorie: OUTILS,
  parcours: [BUSINESS],
  favori: true,
});
export const EXCEL = carteLivre({ id: ID_EXCEL, slug: "excel-pas-a-pas", titre: "Excel pas à pas", auteur: "Awa Diallo", motsCles: ["tableur"], nbPages: 1, acces: "gratuit", categorie: null, parcours: [] });

export const CATALOGUE: CatalogueBibliotheque = {
  livres: [MEMOIRE, VENDRE, EXCEL],
  categories: [
    { ...METHODES, livres: 1 },
    { ...OUTILS, livres: 1 },
    { id: "c3", slug: "vide", nom: "Sans livre", livres: 0 },
  ],
  parcours: [
    { ...ACADEMIQUE, livres: 1 },
    { ...BUSINESS, livres: 1 },
    { id: "p2", slug: "competences-digitales", nom: "Compétences digitales", nomCourt: "Digital", couleur: "digital", livres: 0 },
  ],
};

export function ficheLivre(o: Partial<FicheLivre> = {}): FicheLivre {
  return { ...carteLivre(), tailleOctets: 1_200_000, modifieLe: "2026-11-02T08:00:00Z", formations: [], ...o };
}
