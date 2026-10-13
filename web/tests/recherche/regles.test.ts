import { describe, expect, it } from "vitest";
import { correspond, recommandations, rechercher, type LeconTrouvable } from "@/lib/recherche/regles";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

const PARCOURS = PARCOURS_DESIGN.map((p) => ({ ...p, description: p.slug === "competences-digitales" ? "Design, intelligence artificielle et automatisation." : "" }));
const lecon = (id: string, titre: string, module: string, formation = { slug: "maitriser-microsoft-excel", titre: "Maîtriser Microsoft Excel" }): LeconTrouvable => ({
  id,
  titre,
  dureeSecondes: 370,
  accessible: true,
  formation,
  module: { numero: 1, titre: module },
});
const LECONS = [
  lecon("l1", "Découvrir l’interface", "Bases d’Excel"),
  lecon("l2", "Les tableaux croisés dynamiques", "Analyse de données"),
  lecon("l3", "Installer Zotero", "Premiers pas", { slug: "zotero-gerer-ses-references", titre: "Zotero : gérer ses références" }),
];

describe("Recherche", () => {
  it("sans accents ni majuscules ; tous les mots de la requête doivent apparaître", () => {
    expect(correspond("Zotero : gérer ses références", "zotéro")).toBe(true);
    expect(correspond("Maîtriser Microsoft Excel", "EXCEL")).toBe(true);
    expect(correspond("Les tableaux croisés dynamiques", "tableaux croises")).toBe(true);
    expect(correspond("Les tableaux croisés dynamiques", "tableaux word")).toBe(false);
    expect(correspond("Excel", "")).toBe(false);
    expect(correspond("Excel", "   ")).toBe(false);
  });

  it("« excel » trouve la formation et les leçons de son module « Bases d’Excel »", () => {
    const r = rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: LECONS }, "excel");
    expect(r.formations.map((c) => c.slug)).toEqual(["maitriser-microsoft-excel"]);
    expect(r.lecons.map((l) => l.id)).toEqual(["l1"]);
    expect(r.total).toBe(r.formations.length + r.parcours.length + r.lecons.length);
  });

  it("un parcours se trouve aussi par une formation qu'il contient (« excel » → Réussite académique)", () => {
    expect(rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: LECONS }, "excel").parcours.map((p) => p.slug)).toEqual(["reussite-academique"]);
  });

  it("un parcours se trouve par sa description ; une leçon par son titre", () => {
    const r = rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: LECONS }, "intelligence artificielle");
    expect(r.parcours.map((p) => p.slug)).toEqual(["competences-digitales"]);
    expect(rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: LECONS }, "croisés").lecons.map((l) => l.id)).toEqual(["l2"]);
  });

  it("une requête vide ne cherche rien", () => {
    expect(rechercher({ cartes: CARTES_DESIGN, parcours: PARCOURS, lecons: LECONS }, "  ")).toEqual({ formations: [], parcours: [], lecons: [], total: 0 });
  });

  it("recommandations : non commencées, « Populaire » puis « Nouveau » d'abord, trois au plus", () => {
    const excel = CARTES_DESIGN.find((c) => c.slug === "maitriser-microsoft-excel")!;
    const choix = recommandations(CARTES_DESIGN, new Set([excel.id]));
    expect(choix).toHaveLength(3);
    expect(choix.map((c) => c.id)).not.toContain(excel.id);
    const rangs = choix.map((c) => (c.badge === "populaire" ? 0 : c.badge === "nouveau" ? 1 : c.gratuite ? 2 : 3));
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
  });
});
