import { describe, expect, it } from "vitest";
import { tableauDeBord } from "@/lib/accueil/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { formationsSuivies, type FicheSuivie } from "@/lib/mes-formations/regles";
import type { LigneProgression } from "@/lib/progression/types";
import { CARTES_DESIGN, parSlug } from "../catalogue/cartes-design";
import { EXCEL, EXCEL_OUVERTE, id, ZOTERO } from "../lecon/donnees";

/** Ligne de progression : leçon n d'une formation, terminée ou non, vue il y a `ilYa` minutes. */
const ligne = (formationId: string, n: number, terminee: boolean, ilYa: number): LigneProgression => ({
  leconId: id(n),
  formationId,
  termineeLe: terminee ? "2026-10-12T10:00:00Z" : null,
  vueLe: new Date(Date.UTC(2026, 9, 13, 12) - ilYa * 60_000).toISOString(),
  positionSecondes: 0,
});
const avec = (f: FicheFormation, statut: FicheSuivie["statut"] = "publiee"): FicheSuivie => ({ ...f, statut });
const ouverte = (f: FicheFormation): FicheFormation => ({ ...f, modules: f.modules.map((m) => ({ ...m, lecons: m.lecons.map((l) => ({ ...l, accessible: true })) })) });
const ZOTERO_OUVERTE = ouverte(ZOTERO);
/** Une formation du catalogue du design, avec une leçon ouverte (identifiant n). */
const formation = (slug: string, n: number, dureeSecondes = 600): FicheFormation =>
  ouverte({ ...ZOTERO, ...parSlug(slug), modules: [{ id: id(900 + n), titre: "Premiers pas", lecons: [{ id: id(n), titre: `Leçon ${n}`, titreCourt: null, dureeSecondes, apercu: false, accessible: true }] }] });
const tableau = (fiches: FicheSuivie[], lignes: LigneProgression[]) => tableauDeBord(formationsSuivies(fiches, lignes, new Set()), CARTES_DESIGN);

describe("Tableau de bord", () => {
  it("rien commencé : ni reprise, ni à faire, ni recommandations ; les formations gratuites", () => {
    const t = tableauDeBord([], CARTES_DESIGN);
    expect(t).toMatchObject({ commencees: 0, enCours: 0, progressionGlobale: 0, reprise: null, aFaire: [], recommandees: [] });
    expect(t.gratuites.map((c) => c.slug)).toEqual(["zotero-gerer-ses-references", "canva-debutant-a-expert"]);
  });

  it("reprise : la formation en cours la plus récente, sur sa leçon à reprendre ; les autres dans « À faire »", () => {
    const fiches = [avec(EXCEL_OUVERTE), avec(ZOTERO_OUVERTE)];
    const lignes = [ligne(EXCEL_OUVERTE.id, 1, true, 20), ligne(EXCEL_OUVERTE.id, 2, false, 10), ligne(ZOTERO.id, 21, false, 30)];
    const suivies = formationsSuivies(fiches, lignes, new Set());
    const t = tableauDeBord(suivies, CARTES_DESIGN);
    expect(t.reprise).toEqual({
      formationId: EXCEL_OUVERTE.id,
      titre: "Maîtriser Microsoft Excel",
      parcours: "academique",
      etiquette: { tone: "academique", libelle: "Académique" },
      lienParcours: "/parcours?parcours=reussite-academique",
      sousTitre: "Module 1 · Saisir et mettre en forme des données · 13 min",
      pourcentage: 8,
      temps: suivies.find((s) => s.fiche.id === EXCEL_OUVERTE.id)!.temps,
      href: `/formations/maitriser-microsoft-excel/lecons/${id(2)}`,
    });
    expect(t.aFaire).toEqual([
      { id: ZOTERO.id, titre: "Leçon suivante", sousTitre: "Zotero : gérer ses références · Installer Zotero", href: `/formations/zotero-gerer-ses-references/lecons/${id(21)}` },
    ]);
    expect(t.gratuites).toEqual([]);
  });

  it("une leçon sans durée : le sous-titre s'arrête au titre de la leçon", () => {
    const sansDuree = formation("canva-debutant-a-expert", 31, 0);
    expect(tableau([avec(sansDuree)], [ligne(sansDuree.id, 31, false, 5)]).reprise?.sousTitre).toBe("Module 1 · Leçon 31");
  });

  it("indicateurs : moyenne de toutes les formations commencées ; « en cours » sans les terminées", () => {
    const t = tableau(
      [avec(EXCEL_OUVERTE), avec(ZOTERO_OUVERTE)],
      [ligne(EXCEL_OUVERTE.id, 1, true, 20), ligne(ZOTERO.id, 21, true, 30), ligne(ZOTERO.id, 22, true, 25)],
    );
    expect(t).toMatchObject({ commencees: 2, enCours: 1, progressionGlobale: 54 });
  });

  it("une formation verrouillée (aperçus vus, ou archivée) compte dans la moyenne mais n'est jamais proposée", () => {
    const word = formation("microsoft-word-travaux-universitaires", 41);
    const t = tableau(
      [avec(EXCEL), avec(word, "archivee"), avec(ZOTERO_OUVERTE)],
      [ligne(EXCEL.id, 1, true, 5), ligne(EXCEL.id, 2, true, 4), ligne(word.id, 41, false, 3), ligne(ZOTERO.id, 21, false, 30)],
    );
    expect(t).toMatchObject({ commencees: 3, enCours: 1, progressionGlobale: 6 });
    expect(t.reprise?.formationId).toBe(ZOTERO.id);
    expect(t.aFaire).toEqual([]);
  });

  it("huit formations en cours : la plus récente à reprendre, les cinq suivantes à faire", () => {
    const ids = ["f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"];
    const t = tableau(
      ids.map((f) => avec({ ...EXCEL_OUVERTE, id: f })),
      ids.map((f, i) => ligne(f, 1, false, i)),
    );
    expect(t.reprise?.formationId).toBe("f1");
    expect(t.aFaire.map((a) => a.id)).toEqual(["f2", "f3", "f4", "f5", "f6"]);
  });

  it("recommandées : les formations non commencées des mêmes parcours, dans l'ordre du parcours", () => {
    const t = tableau(
      [avec(EXCEL_OUVERTE), avec(ZOTERO_OUVERTE)],
      [ligne(EXCEL_OUVERTE.id, 1, false, 10), ligne(ZOTERO.id, 21, false, 30)],
    );
    expect(t.recommandees.map((c) => c.slug)).toEqual(["microsoft-word-travaux-universitaires", "powerpoint-reussir-sa-soutenance", "methodologie-du-memoire"]);
  });

  it("recommandées : complétées par les populaires, sans doublon ni formation commencée (même à 0 %)", () => {
    const marketing = formation("marketing-digital-debutants", 51);
    const methodologie = formation("methodologie-du-memoire", 52);
    const t = tableau([avec(marketing), avec(methodologie)], [ligne(marketing.id, 51, false, 5), ligne(methodologie.id, 52, false, 50)]);
    // Business d’abord (Marketing, la plus récente) : Freelance ; puis Académique, dans l’ordre du parcours : Word, Excel.
    expect(t.recommandees.map((c) => c.slug)).toEqual(["lancer-son-activite-freelance", "microsoft-word-travaux-universitaires", "maitriser-microsoft-excel"]);
    const seul = tableau([avec(marketing)], [ligne(marketing.id, 51, false, 5)]);
    expect(seul.recommandees.map((c) => c.slug)).toEqual(["lancer-son-activite-freelance", "maitriser-microsoft-excel", "methodologie-du-memoire"]);
  });
});
