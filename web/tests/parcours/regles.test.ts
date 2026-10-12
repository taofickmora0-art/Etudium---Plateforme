import { describe, expect, it } from "vitest";
import { etatFormation, formationsDuParcours, progressionDuParcours } from "@/lib/parcours/regles";
import { CARTES_DESIGN, parSlug } from "../catalogue/cartes-design";

describe("Règles de la page Mes parcours", () => {
  it("les formations d'un parcours suivent leur position (back-office)", () => {
    expect(formationsDuParcours(CARTES_DESIGN, "reussite-academique").map((c) => c.slug)).toEqual([
      "microsoft-word-travaux-universitaires",
      "maitriser-microsoft-excel",
      "powerpoint-reussir-sa-soutenance",
      "zotero-gerer-ses-references",
      "methodologie-du-memoire",
    ]);
    expect(formationsDuParcours(CARTES_DESIGN, "inconnu")).toEqual([]);
  });

  it("l'état d'une formation : terminée, en cours, gratuite, verrouillée", () => {
    expect(etatFormation(parSlug("zotero-gerer-ses-references"))).toEqual({ libelle: "Gratuite", ton: "gratuit" });
    expect(etatFormation(parSlug("maitriser-microsoft-excel"))).toEqual({ libelle: "Verrouillée", ton: "verrouillee", verrou: true });
    expect(etatFormation(parSlug("maitriser-microsoft-excel"), { pourcentage: 68, terminee: false })).toEqual({ libelle: "68 %", ton: "nouveau" });
    expect(etatFormation(parSlug("microsoft-word-travaux-universitaires"), { pourcentage: 100, terminee: true })).toEqual({ libelle: "Terminé", ton: "valide" });
  });

  it("la progression d'un parcours est la moyenne de ses formations", () => {
    const cartes = formationsDuParcours(CARTES_DESIGN, "reussite-academique").slice(0, 3);
    const progressions = new Map([
      ["microsoft-word-travaux-universitaires", { pourcentage: 100, terminee: true }],
      ["maitriser-microsoft-excel", { pourcentage: 68, terminee: false }],
    ]);
    expect(progressionDuParcours(cartes, progressions)).toEqual({ pourcentage: 56, terminees: 1, total: 3 });
    expect(progressionDuParcours([], new Map())).toEqual({ pourcentage: 0, terminees: 0, total: 0 });
  });
});
