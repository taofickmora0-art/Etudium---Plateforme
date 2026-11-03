import { describe, expect, it } from "vitest";
import {
  adresseLecture,
  adresseLivre,
  boutonLecture,
  ecrireFiltresBibliotheque,
  FILTRES_BIBLIOTHEQUE_VIDES,
  filtrerLivres,
  filtresActifs,
  lireFiltresBibliotheque,
  progressionLivre,
  zoomApresPincement,
  type FiltresAdresseBibliotheque,
} from "@/lib/bibliotheque/regles";
import type { CarteLivre, LectureLivre } from "@/lib/bibliotheque/types";

// Les règles des pages des étudiants et des visiteurs (étapes B et C) : les filtres de l'adresse, le bouton de lecture,
// la progression affichée sur les cartes, le zoom au doigt du lecteur.

const lecture = (o: Partial<LectureLivre> = {}): LectureLivre => ({
  dernierePage: 42,
  nbPages: 100,
  pourcentage: 42,
  terminee: false,
  ouvertLe: "2026-11-01T10:00:00Z",
  majLe: "2026-11-02T10:00:00Z",
  ...o,
});

describe("Les filtres de la bibliothèque dans l'adresse", () => {
  it("lit la recherche, le parcours, la catégorie et « Gratuits » ; ignore une adresse mal formée", () => {
    expect(lireFiltresBibliotheque({})).toEqual({ q: "", parcours: null, categorie: null, gratuits: false });
    expect(lireFiltresBibliotheque({ q: "  mémoire ", parcours: "reussite-academique", categorie: "methodes", gratuits: "1" })).toEqual({
      q: "mémoire",
      parcours: "reussite-academique",
      categorie: "methodes",
      gratuits: true,
    });
    // Un tableau (?q=a&q=b) : la première valeur ; une adresse hors format : ignorée ; 100 caractères au plus.
    expect(lireFiltresBibliotheque({ q: ["excel", "word"], parcours: "<script>", categorie: "A B" })).toEqual({ q: "excel", parcours: null, categorie: null, gratuits: false });
    expect(lireFiltresBibliotheque({ q: "x".repeat(150) }).q).toHaveLength(100);
    expect(lireFiltresBibliotheque({ gratuits: "non" }).gratuits).toBe(false);
  });

  it("écrit l'adresse dans l'ordre parcours, catégorie, gratuits, recherche ; rien sans filtre", () => {
    expect(ecrireFiltresBibliotheque({ q: "", parcours: null, categorie: null, gratuits: false })).toBe("");
    expect(ecrireFiltresBibliotheque({ q: "réussir son mémoire", parcours: "business", categorie: "methodes", gratuits: false })).toBe(
      "?parcours=business&categorie=methodes&q=r%C3%A9ussir+son+m%C3%A9moire",
    );
    expect(ecrireFiltresBibliotheque({ q: " ", parcours: null, categorie: null, gratuits: true })).toBe("?gratuits=1");
  });

  it("un filtre est actif dès qu'une recherche, un parcours, une catégorie ou « Gratuits » est choisi", () => {
    expect(filtresActifs({ q: "", parcours: null, categorie: null, gratuits: false })).toBe(false);
    expect(filtresActifs({ q: "  ", parcours: null, categorie: null, gratuits: false })).toBe(false);
    expect(filtresActifs({ q: "", parcours: null, categorie: "x", gratuits: false })).toBe(true);
    expect(filtresActifs({ q: "", parcours: null, categorie: null, gratuits: true })).toBe(true);
  });
});

describe("Le bouton de lecture et la progression", () => {
  it("les adresses de la fiche et du lecteur", () => {
    expect(adresseLivre("reussir-son-memoire")).toBe("/bibliotheque/reussir-son-memoire");
    expect(adresseLecture("reussir-son-memoire")).toBe("/bibliotheque/reussir-son-memoire/lire");
    expect(adresseLecture("reussir-son-memoire", 1)).toBe("/bibliotheque/reussir-son-memoire/lire?page=1");
  });

  it("« Lire » la première fois, « Continuer, page N » ensuite, « Relire » depuis le début un livre terminé", () => {
    expect(boutonLecture({ slug: "guide", lecture: null })).toEqual({ libelle: "Lire", href: "/bibliotheque/guide/lire" });
    expect(boutonLecture({ slug: "guide", lecture: lecture({ dernierePage: 1, pourcentage: 1 }) })).toEqual({ libelle: "Lire", href: "/bibliotheque/guide/lire" });
    expect(boutonLecture({ slug: "guide", lecture: lecture() })).toEqual({ libelle: "Continuer, page 42", href: "/bibliotheque/guide/lire" });
    expect(boutonLecture({ slug: "guide", lecture: lecture({ terminee: true, dernierePage: 100, pourcentage: 100 }) })).toEqual({
      libelle: "Relire",
      href: "/bibliotheque/guide/lire?page=1",
    });
  });

  it("« 42 % lus » pour un livre commencé, « Terminé » pour un livre fini, rien sinon", () => {
    expect(progressionLivre(null)).toBeNull();
    expect(progressionLivre(lecture())).toBe("42 % lus");
    expect(progressionLivre(lecture({ pourcentage: 0, dernierePage: 1 }))).toBe("0 % lus");
    expect(progressionLivre(lecture({ terminee: true, pourcentage: 100 }))).toBe("Terminé");
  });
});

describe("Le zoom au doigt du lecteur", () => {
  it("suit l'écart des deux doigts, entre 50 % et 300 %", () => {
    expect(zoomApresPincement(1, 100, 150)).toBe(1.5);
    expect(zoomApresPincement(1.5, 200, 100)).toBe(0.75);
    expect(zoomApresPincement(2, 100, 400)).toBe(3);
    expect(zoomApresPincement(1, 300, 10)).toBe(0.5);
    // Arrondi au vingtième, pour ne pas redessiner les pages à chaque pixel.
    expect(zoomApresPincement(1, 100, 113)).toBe(1.15);
    // Un écart de départ nul (deux doigts au même point) : rien ne change.
    expect(zoomApresPincement(1.25, 0, 80)).toBe(1.25);
  });
});

describe("Le filtrage du catalogue dans le navigateur", () => {
  const livre = (o: Partial<CarteLivre>): CarteLivre => ({
    id: o.slug ?? "x",
    slug: "x",
    titre: "",
    auteur: "",
    resume: "",
    langue: "fr",
    annee: null,
    motsCles: [],
    nbPages: null,
    couverture: null,
    acces: "abonnes",
    telechargeable: false,
    statut: "publie",
    publieLe: null,
    categorie: null,
    parcours: [],
    ouvert: false,
    accesEtat: "connexion",
    favori: false,
    lecture: null,
    ...o,
  });
  const BUSINESS = { id: "p3", slug: "business", nom: "Business en ligne", nomCourt: "Business", couleur: "business" as const };
  const LIVRES = [
    livre({ slug: "memoire", titre: "Réussir son mémoire", auteur: "Mireille Adjovi", motsCles: ["méthodologie"], categorie: { id: "c1", slug: "methodes", nom: "Méthodes" } }),
    livre({ slug: "vendre", titre: "Vendre en ligne", auteur: "Koffi Mensah", acces: "gratuit", parcours: [BUSINESS] }),
    livre({ slug: "excel", titre: "Excel pas à pas", auteur: "Awa Diallo", motsCles: ["tableur"], acces: "gratuit" }),
  ];
  const slugs = (f: Partial<FiltresAdresseBibliotheque>) => filtrerLivres(LIVRES, { ...FILTRES_BIBLIOTHEQUE_VIDES, ...f }).map((l) => l.slug);

  it("sans filtre : tous les livres, dans leur ordre", () => {
    expect(slugs({})).toEqual(["memoire", "vendre", "excel"]);
  });

  it("la recherche porte sur le titre, l'auteur et les mots-clés, sans accents ni majuscules, tous les mots comptent", () => {
    expect(slugs({ q: "MEMOIRE" })).toEqual(["memoire"]);
    expect(slugs({ q: "mensah" })).toEqual(["vendre"]);
    expect(slugs({ q: "méthodologie" })).toEqual(["memoire"]);
    expect(slugs({ q: "tableur diallo" })).toEqual(["excel"]);
    expect(slugs({ q: "tableur mensah" })).toEqual([]);
  });

  it("parcours, catégorie et « Gratuits » se combinent", () => {
    expect(slugs({ parcours: "business" })).toEqual(["vendre"]);
    expect(slugs({ categorie: "methodes" })).toEqual(["memoire"]);
    expect(slugs({ gratuits: true })).toEqual(["vendre", "excel"]);
    expect(slugs({ gratuits: true, q: "excel" })).toEqual(["excel"]);
    expect(slugs({ parcours: "inconnu" })).toEqual([]);
  });
});
