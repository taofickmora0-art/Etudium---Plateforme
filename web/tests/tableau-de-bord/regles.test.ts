import { describe, expect, it } from "vitest";
import type { FicheSuivie } from "@/lib/mes-formations/regles";
import { formationsSuivies } from "@/lib/mes-formations/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { aFaire, continuer, indicateurs, versBaseTableau } from "@/lib/tableau-de-bord/regles";

// Les règles du tableau de bord (lot 6 B, §1) : les indicateurs, « Continuer l’apprentissage » et « À faire », d'après
// les formations suivies (règles de « Mes formations ») et ce que rend la base.

const PARCOURS = { slug: "academique", nom: "Réussite académique", nomCourt: "Académique", couleur: "academique" as const, ordre: 1, position: 1 };

function fiche(id: string, titre: string, lecons: number, statut: FicheSuivie["statut"] = "publiee"): FicheSuivie {
  const liste = Array.from({ length: lecons }, (_, i) => ({ id: `${id}-l${i + 1}`, titre: `Leçon ${i + 1}`, dureeSecondes: 600, apercu: false, accessible: true, publiee: true, type: "lecon" as const }));
  return {
    id,
    slug: `s-${id}`,
    titre,
    resume: "",
    niveau: "debutant",
    gratuite: true,
    badge: null,
    publieeLe: "2026-09-01T00:00:00Z",
    dureeSecondes: 600 * lecons,
    nbLecons: lecons,
    parcours: [PARCOURS],
    note: null,
    nbAvis: 0,
    couverture: null,
    description: "",
    seuilVideo: 90,
    objectifs: [],
    competences: [],
    formateur: null,
    modules: [
      { id: `${id}-m1`, titre: "Les bases", lecons: liste.slice(0, 2) },
      { id: `${id}-m2`, titre: "Aller plus loin", lecons: liste.slice(2) },
    ],
    statut,
  };
}
const ligne = (formationId: string, leconId: string, vueLe: string, termineeLe: string | null = null): LigneProgression => ({ formationId, leconId, vueLe, termineeLe, positionSecondes: 0 });

// Le 1er novembre à 0 h 30 au Bénin (31 octobre, 23 h 30 UTC).
const MAINTENANT = new Date("2026-10-31T23:30:00Z");
const EXCEL = fiche("f1", "Excel", 4);
const CANVA = fiche("f2", "Canva", 2);
const LIGNES = [
  ligne("f1", "f1-l1", "2026-10-20T10:00:00Z", "2026-10-31T22:50:00Z"), // 31 octobre, 23 h 50 au Bénin : octobre
  ligne("f1", "f1-l2", "2026-10-31T23:15:00Z", "2026-10-31T23:10:00Z"), // 1er novembre, 0 h 10 au Bénin : novembre
  ligne("f1", "f1-l3", "2026-10-31T23:20:00Z"),
  ligne("f2", "f2-l1", "2026-10-30T09:00:00Z"),
];
const suivies = formationsSuivies([EXCEL, CANVA], LIGNES, new Set());

describe("Les indicateurs", () => {
  it("la progression de toutes les formations commencées ; la part de ce mois au Bénin", () => {
    expect(indicateurs(suivies, LIGNES, MAINTENANT)).toEqual({ progression: 33, progressionMois: 17, enCours: 2, commencees: 2 });
  });

  it("rien de commencé : 0 partout", () => {
    expect(indicateurs([], [], MAINTENANT)).toEqual({ progression: 0, progressionMois: 0, enCours: 0, commencees: 0 });
  });
});

describe("Continuer l’apprentissage", () => {
  it("la formation en cours ouverte le plus récemment, et sa leçon où reprendre", () => {
    expect(continuer(suivies)).toEqual({
      titre: "Excel",
      parcours: PARCOURS,
      lecon: "Module 2 · Leçon 3 · 10 min",
      pourcentage: 50,
      temps: "20 min restantes",
      href: "/formations/s-f1/lecons/f1-l3",
      hrefFormation: "/formations/s-f1",
    });
  });

  it("aucune formation en cours : rien", () => {
    expect(continuer([])).toBeNull();
    expect(continuer(formationsSuivies([fiche("f3", "Word", 1)], [ligne("f3", "f3-l1", "2026-10-01T00:00:00Z", "2026-10-01T00:00:00Z")], new Set()))).toBeNull();
  });
});

describe("À faire", () => {
  const base = [
    { type: "quiz" as const, formation: "Excel", slug: "s-f1", leconId: "q1", lecon: "Quiz du module 1" },
    { type: "exercice" as const, formation: "Excel", slug: "s-f1", leconId: "e1", lecon: "Tableau des ventes" },
  ];

  it("d'abord l'exercice à corriger, puis le quiz à repasser, puis la leçon suivante des autres formations ; 3 au plus", () => {
    expect(aFaire(base, suivies)).toEqual([
      { type: "exercice", titre: "Exercice à corriger", detail: "Excel · Tableau des ventes", href: "/formations/s-f1/lecons/e1", etiquette: "À corriger" },
      { type: "quiz", titre: "Quiz à repasser", detail: "Excel · Quiz du module 1", href: "/formations/s-f1/lecons/q1" },
      { type: "lecon", titre: "Leçon suivante", detail: "Canva · Leçon 1", href: "/formations/s-f2/lecons/f2-l1" },
    ]);
    expect(aFaire([...base, ...base], suivies)).toHaveLength(3);
  });

  it("sans rien de la base : les leçons suivantes seules (pas celle de « Continuer »)", () => {
    expect(aFaire([], suivies).map((e) => e.detail)).toEqual(["Canva · Leçon 1"]);
  });
});

describe("La conversion de mon_tableau_de_bord()", () => {
  it("les champs de la base, en camelCase ; ce qui est mal formé est écarté", () => {
    const base = versBaseTableau({
      certificats: { nombre: 2, titres: ["Word", "Zotero"] },
      a_faire: [{ type: "exercice", formation: "Excel", slug: "s-f1", lecon_id: "e1", lecon: "Tableau" }, { type: "autre" }],
      activite: [{ type: "quiz", titre: "Quiz", formation: "Canva", score: 90, quand: "2026-11-01T10:00:00Z" }, { type: "badge", titre: "inconnu", quand: "x" }],
      jeu: { serie: 3, niveau: 2 },
      recommandations: [{ id: "r1", slug: "s-r1", titre: "Mémoire", motif: "suite", message: "Vous avez terminé « Zotero ». Découvrez maintenant « Mémoire »." }, { id: 3 }],
    });
    expect(base.certificats).toEqual({ nombre: 2, titres: ["Word", "Zotero"] });
    expect(base.aFaire).toEqual([{ type: "exercice", formation: "Excel", slug: "s-f1", leconId: "e1", lecon: "Tableau" }]);
    expect(base.activite).toEqual([{ type: "quiz", titre: "Quiz", formation: "Canva", score: 90, quand: "2026-11-01T10:00:00Z" }]);
    expect(base.jeu).toMatchObject({ serie: 3, niveau: 2, pointsSemaine: 0 });
    expect(base.recommandations).toEqual([{ id: "r1", slug: "s-r1", titre: "Mémoire", motif: "suite", message: "Vous avez terminé « Zotero ». Découvrez maintenant « Mémoire »." }]);
    expect(versBaseTableau(null)).toMatchObject({ certificats: { nombre: 0, titres: [] }, aFaire: [], activite: [], recommandations: [] });
  });
});
