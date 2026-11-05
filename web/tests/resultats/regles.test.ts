import { describe, expect, it } from "vitest";
import { cleDepuisNom, refusBareme, refusCredits, refusNote, refusPoids, refusRegles, refusSeuil } from "@/lib/resultats/regles";
import { REGLES_PAR_DEFAUT } from "@/lib/resultats/calcul";

// Les vérifications de la saisie, avant la base (qui revérifie tout, migration 0077).

describe("Le barème", () => {
  it("accepte le défaut ; refuse un total différent de 100 %, deux examens, un type sans nom, un poids hors limites, 7 types", () => {
    expect(refusBareme(REGLES_PAR_DEFAUT.categories)).toBeNull();
    expect(refusBareme([{ cle: "cc", nom: "CC", poids: 39 }, { cle: "examen", nom: "Examen", poids: 60, examen: true }])).toBe("Le total des poids doit faire 100 %.");
    expect(refusBareme([{ cle: "a", nom: "A", poids: 50, examen: true }, { cle: "b", nom: "B", poids: 50, examen: true }])).toBe("Un seul type peut être l’examen.");
    expect(refusBareme([{ cle: "a", nom: " ", poids: 100 }])).toBe("Donne un nom à chaque type de notes.");
    expect(refusBareme([{ cle: "a", nom: "A", poids: 0 }, { cle: "b", nom: "B", poids: 100 }])).toBe("Chaque poids va de 1 à 100 %.");
    expect(refusBareme([])).toBe("Ajoute au moins un type de notes.");
    expect(refusBareme(Array.from({ length: 7 }, (_, i) => ({ cle: `t${i}`, nom: `T${i}`, poids: 10 })))).toBe("Six types de notes au plus.");
    // Des poids décimaux qui font bien 100.
    expect(refusBareme([{ cle: "a", nom: "A", poids: 33.3 }, { cle: "b", nom: "B", poids: 33.3 }, { cle: "c", nom: "C", poids: 33.4 }])).toBeNull();
  });

  it("une clé tirée du nom, sans accents ni espaces, unique dans le barème", () => {
    expect(cleDepuisNom("Contrôle continu", [])).toBe("controle-continu");
    expect(cleDepuisNom("TP", ["tp"])).toBe("tp-2");
    expect(cleDepuisNom("!!!", [])).toBe("type");
    // « rattrapage » désigne le choix « Rattrapage » de la fenêtre d'une note : un type ne la prend pas.
    expect(cleDepuisNom("Rattrapage", [])).toBe("rattrapage-2");
  });
});

describe("Les nombres saisis", () => {
  it("une note entre 0 et son barème ; un barème de 1 à 100", () => {
    expect(refusNote(12, 20)).toBeNull();
    expect(refusNote(12, 10)).toBe("La note doit être entre 0 et 10.");
    expect(refusNote(-1, 20)).toBe("La note doit être entre 0 et 20.");
    expect(refusNote(5, 0)).toBe("Le barème d’une note va de 1 à 100.");
    expect(refusNote(Number.NaN, 20)).toBe("La note doit être entre 0 et 20.");
  });

  it("des crédits de 0,5 à 60 ; un poids d'ECUE de 0,5 à 100 ; un seuil de 0 à 20", () => {
    expect(refusCredits(5)).toBeNull();
    expect(refusCredits(0)).toBe("Les crédits vont de 0,5 à 60.");
    expect(refusCredits(61)).toBe("Les crédits vont de 0,5 à 60.");
    expect(refusPoids(2)).toBeNull();
    expect(refusPoids(0)).toBe("Les crédits (ou le coefficient) vont de 0,5 à 100.");
    expect(refusSeuil(12)).toBeNull();
    expect(refusSeuil(21)).toBe("Un seuil va de 0 à 20.");
  });

  it("les règles entières : seuils, puis barème", () => {
    expect(refusRegles(REGLES_PAR_DEFAUT)).toBeNull();
    expect(refusRegles({ ...REGLES_PAR_DEFAUT, seuilUe: 25 })).toBe("Un seuil va de 0 à 20.");
    expect(refusRegles({ ...REGLES_PAR_DEFAUT, categories: [] })).toBe("Ajoute au moins un type de notes.");
  });
});
