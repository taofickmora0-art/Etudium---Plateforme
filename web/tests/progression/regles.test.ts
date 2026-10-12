import { describe, expect, it } from "vitest";
import { dureeLisible } from "@/lib/catalogue/regles";
import { etatFormation, etatModule, progressionsParFormation } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { CARTES_DESIGN } from "../catalogue/cartes-design";
import { EXCEL, EXCEL_OUVERTE, id } from "../lecon/donnees";

const F = EXCEL.id;
/** Une ligne de progression : leçon n, terminée ou non, vue il y a `ilYa` minutes. */
const ligne = (n: number, terminee: boolean, ilYa = 60, formationId = F): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12, 0) - ilYa * 60_000).toISOString(),
  positionSecondes: 0,
});

describe("Progression d'une formation", () => {
  it("pourcentage = leçons terminées ÷ leçons ; le temps restant compte les leçons non terminées", () => {
    const etat = etatFormation(EXCEL_OUVERTE, [ligne(1, true, 50), ligne(2, true, 40), ligne(3, true, 30), ligne(4, false, 10)]);
    expect(etat).toMatchObject({ pourcentage: 25, total: 12, commencee: true, terminee: false });
    expect([...etat.terminees]).toEqual([id(1), id(2), id(3)]);
    expect(etat.restantSecondes).toBe(8407 - 370 - 750 - 845);
    expect(dureeLisible(etat.restantSecondes)).toBe("1 h 47");
  });

  it("la leçon où reprendre est la dernière ouverte, si elle n'est pas terminée", () => {
    expect(etatFormation(EXCEL_OUVERTE, [ligne(1, true, 50), ligne(4, false, 10)]).aReprendre?.id).toBe(id(4));
  });

  it("si la dernière ouverte est terminée, c'est la suivante (d'un module à l'autre)", () => {
    expect(etatFormation(EXCEL_OUVERTE, [ligne(3, false, 50), ligne(4, true, 10)]).aReprendre?.id).toBe(id(5));
  });

  it("une leçon fermée n'est jamais proposée", () => {
    // Excel vue sans formule : seuls les deux aperçus sont ouverts.
    expect(etatFormation(EXCEL, [ligne(1, true, 10)]).aReprendre?.id).toBe(id(2));
    expect(etatFormation(EXCEL, [ligne(1, true, 20), ligne(2, true, 10)]).aReprendre).toBeNull();
  });

  it("une formation non commencée, ou terminée", () => {
    expect(etatFormation(EXCEL_OUVERTE, [])).toMatchObject({ pourcentage: 0, commencee: false, aReprendre: null });
    const tout = EXCEL_OUVERTE.modules.flatMap((m) => m.lecons).map((l, i) => ({ ...ligne(1, true, i), leconId: l.id }));
    expect(etatFormation(EXCEL_OUVERTE, tout)).toMatchObject({ pourcentage: 100, terminee: true, aReprendre: null, restantSecondes: 0 });
  });

  it("les lignes d'une autre formation sont ignorées", () => {
    expect(etatFormation(EXCEL_OUVERTE, [ligne(1, true, 10, "autre")])).toMatchObject({ pourcentage: 0, commencee: false });
  });

  it("l'état d'un module : terminé, en cours, ou rien", () => {
    const [m1, m2, m3] = EXCEL_OUVERTE.modules;
    const terminees = new Set([id(1), id(2), id(3), id(4), id(5)]);
    expect(etatModule(m1, terminees, null)).toBe("termine");
    expect(etatModule(m2, terminees, null)).toBe("en-cours");
    expect(etatModule(m3, new Set(), m3.lecons[1])).toBe("en-cours");
    expect(etatModule(m3, new Set(), null)).toBeNull();
  });
});

describe("Progressions des formations (Mes parcours)", () => {
  it("par adresse de formation, pour les formations commencées", () => {
    const excel = CARTES_DESIGN.find((c) => c.slug === "maitriser-microsoft-excel")!;
    const lignes = [ligne(1, true), ligne(2, true), ligne(3, true), ligne(4, false)].map((l) => ({ ...l, formationId: excel.id }));
    const progressions = progressionsParFormation(CARTES_DESIGN, lignes);
    expect(progressions.get("maitriser-microsoft-excel")).toEqual({ pourcentage: Math.round((100 * 3) / excel.nbLecons), terminee: false });
    expect(progressions.has("zotero-gerer-ses-references")).toBe(false);
  });
});
