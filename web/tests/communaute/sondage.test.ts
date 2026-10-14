import { describe, expect, it } from "vitest";
import { pourcentage, refusProgrammation, refusSondage, versBase, type SondageEnvoye } from "@/lib/communaute/sondage";

// Les règles d'un sondage, d'un quiz et d'une programmation (spec sondages, quiz et programmation, §1 à §5) : les
// mêmes messages que la base.

const texte = (o: Partial<SondageEnvoye> = {}): SondageEnvoye => ({
  type: "texte",
  choixMultiples: false,
  dureeJours: 7,
  explication: "",
  options: [{ texte: "Oui" }, { texte: "Non" }],
  ...o,
});
const IMAGE = { chemin: "c/a.png", nom: "a.png", type: "image/png", taille: 10 };

describe("Le sondage", () => {
  it("2 à 10 options écrites, 80 caractères au plus", () => {
    expect(refusSondage(texte())).toBeNull();
    expect(refusSondage(texte({ options: [{ texte: "Seule" }] }))).toBe("Un sondage a de 2 à 10 options.");
    expect(refusSondage(texte({ options: Array.from({ length: 11 }, (_, i) => ({ texte: `O${i}` })) }))).toBe("Un sondage a de 2 à 10 options.");
    expect(refusSondage(texte({ options: [{ texte: "  " }, { texte: "B" }] }))).toBe("Écrivez chaque option.");
    expect(refusSondage(texte({ options: [{ texte: "x".repeat(81) }, { texte: "B" }] }))).toBe("Une option fait 80 caractères au plus.");
  });

  it("avec images : 2 à 6, chacune son image, le libellé facultatif", () => {
    expect(refusSondage(texte({ type: "images", options: [{ texte: "", image: IMAGE }, { texte: "Rouge", image: IMAGE }] }))).toBeNull();
    expect(refusSondage(texte({ type: "images", options: [{ texte: "Sans" }, { texte: "", image: IMAGE }] }))).toBe("Chaque option d’un sondage avec images a son image.");
    expect(refusSondage(texte({ type: "images", options: Array.from({ length: 7 }, () => ({ texte: "", image: IMAGE })) }))).toBe(
      "Un sondage avec images a de 2 à 6 images.",
    );
  });

  it("quiz : 2 à 6 réponses, une seule bonne, explication de 300 caractères", () => {
    const quiz = (o: Partial<SondageEnvoye> = {}) => texte({ type: "quiz", options: [{ texte: "A", correcte: true }, { texte: "B" }], ...o });
    expect(refusSondage(quiz())).toBeNull();
    expect(refusSondage(quiz({ options: [{ texte: "A" }, { texte: "B" }] }))).toBe("Un quiz a une seule bonne réponse.");
    expect(refusSondage(quiz({ options: [{ texte: "A", correcte: true }, { texte: "B", correcte: true }] }))).toBe("Un quiz a une seule bonne réponse.");
    expect(refusSondage(quiz({ explication: "x".repeat(301) }))).toBe("L’explication fait 300 caractères au plus.");
  });

  it("le format de la base", () => {
    expect(versBase(texte({ choixMultiples: true, dureeJours: null, options: [{ texte: " Oui " }, { texte: "Non" }] }))).toEqual({
      type: "texte",
      choix_multiples: true,
      duree_jours: null,
      explication: null,
      options: [
        { texte: "Oui", image: null, correcte: false },
        { texte: "Non", image: null, correcte: false },
      ],
    });
  });

  it("le pourcentage, arrondi ; aucun vote : 0", () => {
    expect(pourcentage(1, 3)).toBe(33);
    expect(pourcentage(2, 3)).toBe(67);
    expect(pourcentage(0, 0)).toBe(0);
  });
});

describe("La programmation", () => {
  const maintenant = new Date("2026-10-14T15:00:00Z");
  it("de 10 minutes à 3 mois", () => {
    expect(refusProgrammation("2026-10-14T15:20:00Z", maintenant)).toBeNull();
    expect(refusProgrammation("2026-10-14T15:05:00Z", maintenant)).toBe("Choisissez une heure au moins 10 minutes plus tard.");
    expect(refusProgrammation("2027-02-01T15:00:00Z", maintenant)).toBe("Choisissez une date dans les 3 mois qui viennent.");
    expect(refusProgrammation("pas une date", maintenant)).toBe("Choisissez la date et l’heure.");
  });
});
