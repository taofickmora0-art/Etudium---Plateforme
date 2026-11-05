import { describe, expect, it } from "vitest";
import { formaterNote, mention, MODELES_BAREME, noteSur20, REGLES_PAR_DEFAUT, resultatEcue, resultatParcours, resultatSemestre, resultatUe } from "@/lib/resultats/calcul";
import type { Categorie, Ecue, Note, ParcoursComplet, Regles, Ue } from "@/lib/resultats/types";

// Les calculs de « Mes résultats » (spec du 5 novembre 2026, §3) : moyenne d'une ECUE selon le barème (types de notes
// et poids), rattrapage, moyenne d'une UE pondérée par les poids des ECUE, semestre pondéré par les crédits des UE,
// seuils, compensation, mentions, moyennes provisoires et « Ce qu'il te faut ».

let n = 0;
const note = (ecueId: string, categorie: string, valeur: number, o: Partial<Note> = {}): Note => ({
  id: `n${++n}`,
  ecueId,
  categorie,
  libelle: "",
  note: valeur,
  sur: 20,
  rattrapage: false,
  date: null,
  creeLe: `2026-01-01T00:00:${String(n % 60).padStart(2, "0")}Z`,
  ...o,
});
const ecue = (id: string, ueId: string, poids = 1, bareme: Categorie[] | null = null): Ecue => ({ id, ueId, intitule: id, poids, bareme, ordre: 0 });
const ue = (id: string, credits: number, semestreId = "s1"): Ue => ({ id, semestreId, code: "", intitule: id, credits, ordre: 0 });
const R = REGLES_PAR_DEFAUT;
const avec = (o: Partial<Regles>): Regles => ({ ...R, ...o });

describe("Les règles par défaut et les modèles", () => {
  it("40 % de contrôle continu, 60 % d'examen ; seuils à 10 ; sans compensation ; le rattrapage remplace l'examen", () => {
    expect(R).toEqual({
      seuilUe: 10,
      seuilSemestre: 10,
      compensation: false,
      rattrapage: "remplace",
      categories: [
        { cle: "cc", nom: "Contrôle continu", poids: 40 },
        { cle: "examen", nom: "Examen", poids: 60, examen: true },
      ],
    });
    expect(MODELES_BAREME.map((m) => m.nom)).toEqual(["40 % / 60 %", "30 % / 70 %", "50 % / 50 %", "Examen seul"]);
    expect(MODELES_BAREME[3].categories).toEqual([{ cle: "examen", nom: "Examen", poids: 100, examen: true }]);
  });
});

describe("Une ECUE", () => {
  it("40/60 : contrôle continu 12, examen 8 → 9,6", () => {
    const r = resultatEcue(ecue("e", "u"), [note("e", "cc", 12), note("e", "examen", 8)], R);
    expect(r.moyenne).toBeCloseTo(9.6, 10);
    expect(r.provisoire).toBe(false);
    expect(r.categories.map((c) => [c.cle, c.moyenne])).toEqual([["cc", 12], ["examen", 8]]);
  });

  it("dans un type, les notes font une moyenne simple ; une note sur 10 ou sur 40 est ramenée sur 20", () => {
    expect(noteSur20({ note: 7, sur: 10 })).toBe(14);
    expect(noteSur20({ note: 30, sur: 40 })).toBe(15);
    const r = resultatEcue(ecue("e", "u"), [note("e", "cc", 7, { sur: 10 }), note("e", "cc", 10), note("e", "examen", 30, { sur: 40 })], R);
    expect(r.categories[0].moyenne).toBe(12);
    expect(r.moyenne).toBeCloseTo(0.4 * 12 + 0.6 * 15, 10);
  });

  it("le barème propre d'une ECUE prime sur celui du parcours", () => {
    const tp: Categorie[] = [{ cle: "tp", nom: "TP", poids: 100 }];
    expect(resultatEcue(ecue("e", "u", 1, tp), [note("e", "tp", 15)], R).moyenne).toBe(15);
  });

  it("le rattrapage remplace l'examen (le contrôle continu reste) ; ou la meilleure des deux est gardée", () => {
    const notes = [note("e", "cc", 10), note("e", "examen", 6), note("e", "examen", 11, { rattrapage: true })];
    expect(resultatEcue(ecue("e", "u"), notes, R).moyenne).toBeCloseTo(0.4 * 10 + 0.6 * 11, 10);
    const meilleure = avec({ rattrapage: "meilleure" });
    expect(resultatEcue(ecue("e", "u"), [note("e", "cc", 10), note("e", "examen", 13), note("e", "examen", 9, { rattrapage: true })], meilleure).moyenne).toBeCloseTo(0.4 * 10 + 0.6 * 13, 10);
    expect(resultatEcue(ecue("e", "u"), [note("e", "cc", 10), note("e", "examen", 13), note("e", "examen", 9, { rattrapage: true })], R).moyenne).toBeCloseTo(0.4 * 10 + 0.6 * 9, 10);
  });

  it("provisoire : avec le seul contrôle continu, la moyenne est la sienne, et l'écran le dira", () => {
    const r = resultatEcue(ecue("e", "u"), [note("e", "cc", 13)], R);
    expect(r).toMatchObject({ moyenne: 13, provisoire: true });
  });

  it("sans note : ni moyenne ni provisoire", () => {
    expect(resultatEcue(ecue("e", "u"), [], R)).toMatchObject({ moyenne: null, provisoire: false, nbNotes: 0 });
  });

  it("une note d'un type qui n'existe plus dans le barème ne compte pas, et elle est signalée", () => {
    const r = resultatEcue(ecue("e", "u"), [note("e", "cc", 12), note("e", "examen", 8), note("e", "tp", 20)], R);
    expect(r.moyenne).toBeCloseTo(9.6, 10);
    expect(r.nonClassees).toBe(1);
  });

  it("« Ce qu'il te faut » : CC 12 en 40/60 → 8,67 à l'examen pour 10 ; « acquis » si le CC suffit ; « impossible » au-delà de 20", () => {
    const vise = resultatEcue(ecue("e", "u"), [note("e", "cc", 12)], R).noteVisee;
    expect(vise).not.toBeNull();
    expect(typeof vise === "object" && vise !== null ? vise.note : null).toBeCloseTo(26 / 3, 10);
    expect(resultatEcue(ecue("e", "u"), [note("e", "cc", 20)], avec({ seuilUe: 8 })).noteVisee).toBe("acquis");
    expect(resultatEcue(ecue("e", "u"), [note("e", "cc", 0)], avec({ seuilUe: 15 })).noteVisee).toBe("impossible");
    // Examen déjà noté : rien à viser.
    expect(resultatEcue(ecue("e", "u"), [note("e", "cc", 12), note("e", "examen", 8)], R).noteVisee).toBeNull();
  });
});

describe("Une UE", () => {
  const ecues = [ecue("a", "u", 3), ecue("b", "u", 2)];

  it("deux ECUE (12 sur 3 crédits, 8 sur 2) → 10,4 : validée, ses crédits acquis", () => {
    const notes = [note("a", "cc", 12), note("a", "examen", 12), note("b", "cc", 8), note("b", "examen", 8)];
    const r = resultatUe(ue("u", 5), ecues, notes, R);
    expect(r.moyenne).toBeCloseTo(10.4, 10);
    expect(r).toMatchObject({ validee: true, creditsAcquis: 5, provisoire: false });
  });

  it("sous le seuil (ou avec un seuil de 12) : non validée, aucun crédit", () => {
    const notes = [note("a", "cc", 12), note("a", "examen", 12), note("b", "cc", 8), note("b", "examen", 8)];
    expect(resultatUe(ue("u", 5), ecues, notes, avec({ seuilUe: 12 }))).toMatchObject({ validee: false, creditsAcquis: 0 });
  });

  it("sans ECUE, ou sans aucune note : ni moyenne, ni validée, ni provisoire ; avec des notes manquantes : provisoire", () => {
    expect(resultatUe(ue("u", 5), [], [], R)).toMatchObject({ moyenne: null, validee: null, provisoire: false });
    expect(resultatUe(ue("u", 5), ecues, [], R)).toMatchObject({ moyenne: null, validee: null, provisoire: false });
    expect(resultatUe(ue("u", 5), ecues, [note("a", "cc", 14)], R)).toMatchObject({ moyenne: 14, validee: null, provisoire: true });
  });

  it("« Ce qu'il te faut » pour l'UE : la même note aux deux examens manquants", () => {
    // a : CC 12 (3 crédits) ; b : CC 6 (2 crédits) → 0,4·(12·3 + 6·2)/5 + 0,6·x ≥ 10 → x ≥ (10 − 3,84)/0,6.
    const r = resultatUe(ue("u", 5), ecues, [note("a", "cc", 12), note("b", "cc", 6)], R);
    expect(typeof r.noteVisee === "object" && r.noteVisee !== null ? r.noteVisee.note : null).toBeCloseTo((10 - 3.84) / 0.6, 10);
    // Une ECUE sans aucune note : on ne peut rien dire.
    expect(resultatUe(ue("u", 5), ecues, [note("a", "cc", 12)], R).noteVisee).toBeNull();
  });
});

describe("Le semestre et le parcours", () => {
  const ues = [ue("u1", 4), ue("u2", 6)];
  const ecues = [ecue("e1", "u1"), ecue("e2", "u2")];
  const complet = (n1: number, n2: number) => [note("e1", "cc", n1), note("e1", "examen", n1), note("e2", "cc", n2), note("e2", "examen", n2)];

  it("moyenne pondérée par les crédits des UE, crédits acquis, UE validées, mention", () => {
    const r = resultatSemestre(ues, ecues, complet(14, 9), R);
    expect(r.moyenne).toBeCloseTo((14 * 4 + 9 * 6) / 10, 10);
    expect(r).toMatchObject({ credits: 10, creditsAcquis: 4, uesValidees: 1, uesComptees: 2, valide: false, compense: false, mention: "Passable", provisoire: false });
  });

  it("la compensation activée : une moyenne de semestre au seuil acquiert toutes les UE", () => {
    expect(resultatSemestre(ues, ecues, complet(14, 9), avec({ compensation: true }))).toMatchObject({ creditsAcquis: 10, valide: true, compense: true });
    expect(resultatSemestre(ues, ecues, complet(14, 9), avec({ compensation: true, seuilSemestre: 12 }))).toMatchObject({ creditsAcquis: 4, valide: false, compense: false });
  });

  it("une UE encore sans note : le semestre est provisoire, sans mention ; elle n'entre pas dans la moyenne", () => {
    const r = resultatSemestre(ues, ecues, [note("e1", "cc", 15), note("e1", "examen", 15)], R);
    expect(r).toMatchObject({ moyenne: 15, provisoire: true, mention: null, valide: null, uesComptees: 1 });
  });

  it("le parcours : moyenne générale pondérée par les crédits des semestres, crédits cumulés", () => {
    const donnees: ParcoursComplet = {
      parcours: { id: "p", nom: "Licence", etablissement: "", regles: R, ordre: 0 },
      semestres: [
        { id: "s1", parcoursId: "p", nom: "S1", annee: "", ordre: 0 },
        { id: "s2", parcoursId: "p", nom: "S2", annee: "", ordre: 1 },
      ],
      ues: [ue("u1", 30, "s1"), ue("u2", 30, "s2")],
      ecues: [ecue("e1", "u1"), ecue("e2", "u2")],
      notes: [note("e1", "cc", 12), note("e1", "examen", 12), note("e2", "cc", 16), note("e2", "examen", 16)],
    };
    const r = resultatParcours(donnees);
    expect(r.moyenne).toBeCloseTo(14, 10);
    expect(r).toMatchObject({ credits: 60, creditsAcquis: 60 });
    expect(r.semestres.map((s) => s.mention)).toEqual(["Assez bien", "Très bien"]);
  });
});

describe("L'affichage", () => {
  it("les mentions et les notes à deux décimales, avec une virgule", () => {
    expect([9.99, 10, 12, 14, 16].map(mention)).toEqual([null, "Passable", "Assez bien", "Bien", "Très bien"]);
    expect(formaterNote(12.4567)).toBe("12,46");
    expect(formaterNote(10)).toBe("10,00");
  });
});
