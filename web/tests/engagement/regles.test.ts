import { describe, expect, it } from "vitest";
import { BADGES, jours, points, versProgressionJeu } from "@/lib/engagement/regles";

// Les règles de l'engagement côté appli (lot 6 B) : les libellés et la conversion de ce que rend la base (0063).

describe("Les libellés", () => {
  it("jours et points, au singulier jusqu'à 1", () => {
    expect([jours(0), jours(1), jours(8)]).toEqual(["0 jour", "1 jour", "8 jours"]);
    expect([points(0), points(1), points(165)]).toEqual(["0 point", "1 point", "165 points"]);
    expect(points(12500)).toBe("12 500 points");
  });

  it("les 8 badges, avec ce qu'il faut faire pour les obtenir", () => {
    expect(Object.entries(BADGES).map(([code, b]) => [code, b.nom])).toEqual([
      ["premier_pas", "Premier pas"],
      ["serie_3", "Série de 3 jours"],
      ["serie_7", "Série de 7 jours"],
      ["serie_30", "Série de 30 jours"],
      ["premier_quiz", "Premier quiz réussi"],
      ["premier_exercice", "Premier exercice validé"],
      ["premier_certificat", "Premier certificat"],
      ["trois_certificats", "Trois certificats"],
    ]);
    expect(BADGES.premier_pas.condition).toBe("Terminer une première leçon");
    expect(BADGES.serie_7.condition).toBe("7 jours d’apprentissage d’affilée");
  });
});

describe("La conversion de ma_progression_jeu()", () => {
  it("les champs de la base, en camelCase", () => {
    expect(
      versProgressionJeu({
        serie: 8,
        points_total: 765,
        points_semaine: 165,
        niveau: 4,
        points_avant_niveau: 35,
        objectif_jours: 3,
        jours_semaine: [true, true, false, true, false, false, false],
        badges: [{ code: "premier_pas", obtenu_le: "2026-11-02T10:00:00Z" }],
      }),
    ).toEqual({
      serie: 8,
      pointsTotal: 765,
      pointsSemaine: 165,
      niveau: 4,
      pointsAvantNiveau: 35,
      objectifJours: 3,
      joursSemaine: [true, true, false, true, false, false, false],
      badges: [{ code: "premier_pas", obtenuLe: "2026-11-02T10:00:00Z" }],
    });
  });

  it("un champ absent ou faux : des valeurs sûres (0, niveau 1, objectif 5, 7 jours non faits) ; un badge inconnu est ignoré", () => {
    const vide = { serie: 0, pointsTotal: 0, pointsSemaine: 0, niveau: 1, pointsAvantNiveau: 200, objectifJours: 5, joursSemaine: Array(7).fill(false), badges: [] };
    expect(versProgressionJeu(null)).toEqual(vide);
    expect(versProgressionJeu(false)).toEqual(vide);
    expect(versProgressionJeu({ serie: "x", objectif_jours: 4, jours_semaine: [true], badges: [{ code: "inconnu" }, null] })).toEqual({ ...vide, joursSemaine: [true, false, false, false, false, false, false] });
  });
});
