import { describe, expect, it } from "vitest";
import {
  actionsLivre,
  cheminCouvertureValide,
  cheminPdfValide,
  estFiltreLivres,
  ETATS_LIVRE,
  LIBELLES_ACCES,
  LIVRE_MAX_OCTETS,
  motsClesDe,
  saisieVersLigne,
  verifierPdf,
} from "@/lib/bibliotheque/regles";
import { versBibliothequeAdmin, versCatalogue, versCarteLivre, versCategoriesRangees, versFicheLivre } from "@/lib/bibliotheque/conversion";
import type { SaisieLivre } from "@/lib/bibliotheque/types";

// Les règles de la Bibliothèque communes au navigateur et au serveur, et la lecture des réponses de la base (0074).

const ID = "11111111-1111-4111-8111-111111111111";
const UUID = "22222222-2222-4222-8222-222222222222";
const PDF = new TextEncoder().encode("%PDF-1.7\n");

describe("Le PDF d'un livre", () => {
  it("un PDF de 50 Mo au plus, reconnu à ses premiers octets (pas à son nom)", () => {
    expect(LIVRE_MAX_OCTETS).toBe(52428800);
    expect(verifierPdf({ name: "guide.pdf", size: 1000 }, PDF)).toEqual({ ok: true });
    expect(verifierPdf({ name: "GUIDE.PDF", size: LIVRE_MAX_OCTETS }, PDF)).toEqual({ ok: true });
    expect(verifierPdf({ name: "guide.pdf", size: LIVRE_MAX_OCTETS + 1 }, PDF)).toEqual({ ok: false, erreur: "Ce fichier dépasse 50 Mo." });
    expect(verifierPdf({ name: "guide.docx", size: 1000 }, new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toEqual({
      ok: false,
      erreur: "Choisissez un fichier PDF.",
    });
    expect(verifierPdf({ name: "faux.pdf", size: 1000 }, new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toEqual({
      ok: false,
      erreur: "Choisissez un fichier PDF.",
    });
  });

  it("les chemins : le PDF et la couverture dans le dossier du livre", () => {
    expect(cheminPdfValide(ID, `${ID}/${UUID}.pdf`)).toBe(true);
    expect(cheminPdfValide(ID, `${UUID}/${UUID}.pdf`)).toBe(false);
    expect(cheminPdfValide(ID, `${ID}/${UUID}.docx`)).toBe(false);
    expect(cheminCouvertureValide(ID, `livres/${ID}/${UUID}.jpg`)).toBe(true);
    expect(cheminCouvertureValide(ID, `livres/${ID}/${UUID}.webp`)).toBe(true);
    expect(cheminCouvertureValide(ID, `${ID}/${UUID}.jpg`)).toBe(false);
    expect(cheminCouvertureValide(ID, `livres/${ID}/${UUID}.gif`)).toBe(false);
  });
});

describe("Les libellés et les actions", () => {
  it("états et accès", () => {
    expect(ETATS_LIVRE).toEqual({ brouillon: "Brouillon", publie: "Publié", archive: "Archivé" });
    expect(LIBELLES_ACCES).toEqual({ gratuit: "Gratuit", abonnes: "Inclus dans l’abonnement" });
  });

  it("un brouillon se publie ou se supprime ; publié, il s'archive ; archivé, il se republie", () => {
    expect(actionsLivre("brouillon")).toEqual(["publier", "supprimer"]);
    expect(actionsLivre("publie")).toEqual(["archiver"]);
    expect(actionsLivre("archive")).toEqual(["republier"]);
  });

  it("le filtre de la page du back-office (?etat=…), lu aussi par le serveur", () => {
    for (const f of ["tous", "publie", "brouillon", "archive"]) expect(estFiltreLivres(f)).toBe(true);
    for (const f of ["publies", "", undefined, null, 1]) expect(estFiltreLivres(f)).toBe(false);
  });
});

describe("Les mots-clés", () => {
  it("séparés par des virgules, sans doublon ni vide, 20 au plus, 40 caractères chacun", () => {
    expect(motsClesDe(" mémoire, Méthodologie ,, mémoire ,rédaction ")).toEqual(["mémoire", "Méthodologie", "rédaction"]);
    expect(motsClesDe("")).toEqual([]);
    expect(motsClesDe(Array.from({ length: 25 }, (_, i) => `mot${i}`).join(","))).toHaveLength(20);
    expect(motsClesDe("a".repeat(60))[0]).toHaveLength(40);
  });
});

describe("La saisie d'un livre", () => {
  const SAISIE: SaisieLivre = {
    id: ID,
    nouveau: true,
    titre: "  Réussir son mémoire  ",
    auteur: " Dr Mireille Adjovi ",
    resume: "Un guide.",
    langue: "fr",
    annee: "2025",
    motsCles: "mémoire, méthodologie",
    nbPages: "120",
    categorieId: null,
    parcours: [],
    acces: "abonnes",
    telechargeable: false,
    droitsConfirmes: true,
  };

  it("devient la ligne à enregistrer, avec les erreurs de chaque champ", () => {
    expect(saisieVersLigne(SAISIE)).toEqual({
      ok: true,
      ligne: {
        titre: "Réussir son mémoire",
        auteur: "Dr Mireille Adjovi",
        resume: "Un guide.",
        langue: "fr",
        annee: 2025,
        mots_cles: ["mémoire", "méthodologie"],
        nb_pages: 120,
        categorie_id: null,
        acces: "abonnes",
        telechargeable: false,
        droits_confirmes: true,
      },
    });
    expect(saisieVersLigne({ ...SAISIE, annee: "", nbPages: "" })).toMatchObject({ ok: true, ligne: { annee: null, nb_pages: null } });
  });

  it("refuse un titre vide, une année ou un nombre de pages impossibles, une langue inconnue", () => {
    expect(saisieVersLigne({ ...SAISIE, titre: "  " })).toEqual({ ok: false, erreurs: { titre: "Entrez le titre du livre." } });
    expect(saisieVersLigne({ ...SAISIE, annee: "20a5" })).toEqual({ ok: false, erreurs: { annee: "Une année à quatre chiffres, par exemple 2024." } });
    expect(saisieVersLigne({ ...SAISIE, annee: "3000" })).toEqual({ ok: false, erreurs: { annee: "Une année à quatre chiffres, par exemple 2024." } });
    expect(saisieVersLigne({ ...SAISIE, nbPages: "0" })).toEqual({ ok: false, erreurs: { nbPages: "Un nombre de pages entre 1 et 100 000." } });
    expect(saisieVersLigne({ ...SAISIE, langue: "xx" })).toEqual({ ok: false, erreurs: { langue: "Choisissez la langue du livre." } });
    expect(saisieVersLigne({ ...SAISIE, titre: "x".repeat(201) })).toEqual({ ok: false, erreurs: { titre: "200 caractères au maximum." } });
    expect(saisieVersLigne({ ...SAISIE, resume: "x".repeat(2001) })).toEqual({ ok: false, erreurs: { resume: "2 000 caractères au maximum." } });
  });
});

describe("La lecture des réponses de la base", () => {
  const brut = {
    id: ID,
    slug: "reussir-son-memoire",
    titre: "Réussir son mémoire",
    auteur: "Dr Mireille Adjovi",
    resume: "",
    langue: "fr",
    annee: 2025,
    mots_cles: ["mémoire"],
    nb_pages: 120,
    categorie: { id: UUID, slug: "methodes", nom: "Méthodes" },
    parcours: [{ id: UUID, slug: "reussite-academique", nom: "Réussite académique", nom_court: "Académique", couleur: "academique" }],
    fichier: `${ID}/${UUID}.pdf`,
    taille_octets: 1200000,
    couverture: null,
    acces: "gratuit",
    telechargeable: true,
    droits_confirmes: true,
    statut: "publie",
    cree_le: "2026-11-03T08:00:00Z",
    modifie_le: "2026-11-03T09:00:00Z",
    publie_le: "2026-11-03T09:00:00Z",
    lectures: 12,
    lectures_terminees: 3,
    lectures_30j: 5,
    telechargements: 4,
    telechargements_30j: 2,
    favoris: 1,
    formations: 2,
  };

  it("livres_back_office → les totaux et les livres ; une ligne sans identifiant écartée ; valeurs inconnues ramenées", () => {
    const bo = versBibliothequeAdmin({
      totaux: { publies: 1, brouillons: 2, archives: 0, lectures: 12, lectures_30j: 5, telechargements: 4, telechargements_30j: 2 },
      livres: [brut, { titre: "Sans id" }],
    });
    expect(bo.totaux).toEqual({ publies: 1, brouillons: 2, archives: 0, lectures: 12, lectures30j: 5, telechargements: 4, telechargements30j: 2 });
    expect(bo.livres).toHaveLength(1);
    expect(bo.livres[0]).toMatchObject({
      id: ID,
      motsCles: ["mémoire"],
      nbPages: 120,
      categorie: { id: UUID, slug: "methodes", nom: "Méthodes" },
      parcours: [{ id: UUID, nomCourt: "Académique", couleur: "academique" }],
      tailleOctets: 1200000,
      acces: "gratuit",
      droitsConfirmes: true,
      statut: "publie",
      lectures: 12,
      lecturesTerminees: 3,
      telechargements: 4,
      formations: 2,
    });
    expect(versBibliothequeAdmin({ livres: [{ id: ID, statut: "bizarre", acces: "?" }] }).livres[0]).toMatchObject({
      statut: "brouillon",
      acces: "abonnes",
      lectures: 0,
      parcours: [],
      categorie: null,
    });
    expect(versBibliothequeAdmin(null)).toEqual({
      totaux: { publies: 0, brouillons: 0, archives: 0, lectures: 0, lectures30j: 0, telechargements: 0, telechargements30j: 0 },
      livres: [],
    });
  });

  it("carte_livre, livre_fiche et le catalogue (étape B)", () => {
    const carte = versCarteLivre({
      ...brut,
      ouvert: true,
      acces_etat: "ouvert",
      favori: true,
      lecture: { derniere_page: 42, nb_pages: 120, pourcentage: 35, terminee: false, ouvert_le: "2026-11-03T10:00:00Z", maj_le: "2026-11-03T11:00:00Z" },
    });
    expect(carte).toMatchObject({
      id: ID,
      ouvert: true,
      accesEtat: "ouvert",
      favori: true,
      lecture: { dernierePage: 42, nbPages: 120, pourcentage: 35, terminee: false },
    });
    expect(carte).not.toHaveProperty("fichier");
    expect(versCarteLivre({ ...brut, acces_etat: "n'importe quoi" })?.accesEtat).toBe("ferme");
    expect(versCarteLivre({ titre: "Sans id" })).toBeNull();
    const fiche = versFicheLivre({ ...brut, formations: [{ id: UUID, slug: "methodologie", titre: "Méthodologie", couverture: null }] });
    expect(fiche).toMatchObject({ tailleOctets: 1200000, formations: [{ id: UUID, slug: "methodologie", titre: "Méthodologie", couverture: null }] });
    expect(versFicheLivre(null)).toBeNull();
    const catalogue = versCatalogue({
      livres: [brut],
      categories: [{ id: UUID, slug: "methodes", nom: "Méthodes", livres: 3 }],
      parcours: [{ ...brut.parcours[0], livres: 1 }],
    });
    expect(catalogue.livres).toHaveLength(1);
    expect(catalogue.categories).toEqual([{ id: UUID, slug: "methodes", nom: "Méthodes", livres: 3 }]);
    expect(catalogue.parcours[0]).toMatchObject({ slug: "reussite-academique", livres: 1 });
  });

  it("les catégories rangées (table categories_livres)", () => {
    expect(versCategoriesRangees([{ id: UUID, slug: "b", nom: "B", ordre: 2 }, { id: ID, slug: "a", nom: "A", ordre: 1 }, { nom: "Sans id" }])).toEqual([
      { id: ID, slug: "a", nom: "A", ordre: 1 },
      { id: UUID, slug: "b", nom: "B", ordre: 2 },
    ]);
  });
});
