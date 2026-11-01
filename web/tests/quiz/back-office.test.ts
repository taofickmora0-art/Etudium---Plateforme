import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lot 3, étape A : créer un quiz, enregistrer ses questions, régler le score minimal de la formation.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { addLecon, saveFormationInfos, changerStatutLecon, setStatutFormation } = await import("@/lib/admin/actions");
const { getFormationAdmin, getLeconAdmin, listFormations } = await import("@/lib/admin/data");
const { IDLE } = await import("@/lib/auth/schemas");

const F = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const L = "33333333-3333-4333-8333-333333333333";
const MIGRATION = "Appliquez la migration 0031 (guide « Ce qui te revient », section 37).";
const form = (valeurs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  faux.vider();
  getShellUser.mockReset().mockResolvedValue({ roles: ["etudiant", "formateur"] });
});

describe("Créer un quiz", () => {
  it("« Nouvelle leçon » de type quiz : la leçon est créée comme quiz ; une leçon ordinaire ne précise pas son type", async () => {
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: null } } });
    faux.repondre("lecons.insert", { data: { id: L } });
    expect(await addLecon(IDLE, form({ module_id: M, titre: "Quiz du module 1", type: "quiz", espace: "formateur" }))).toMatchObject({ status: "success" });
    // Un quiz naît en brouillon, même dans une formation jamais publiée : il n'a pas encore de questions.
    expect(faux.de("lecons", "insert")[0].valeurs).toMatchObject({ titre: "Quiz du module 1", type: "quiz", publiee: false });
    faux.vider();
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: null } } });
    faux.repondre("lecons.insert", { data: { id: L } });
    await addLecon(IDLE, form({ module_id: M, titre: "Leçon" }));
    expect(faux.de("lecons", "insert")[0].valeurs).not.toHaveProperty("type");
  });

  it("avant la 0031, un quiz ne peut pas être créé : le message de la migration", async () => {
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: null } } });
    faux.repondre("lecons.insert", { error: { code: "PGRST204", message: "Could not find the 'type' column of 'lecons'" } });
    expect(await addLecon(IDLE, form({ module_id: M, titre: "Quiz", type: "quiz" }))).toMatchObject({ status: "error", message: MIGRATION });
  });
});

describe("Publier un quiz, publier la formation", () => {
  it("un quiz sans question : le refus de la base est affiché", async () => {
    faux.repondre("lecons.update", { error: { code: "P0001", message: "Ajoutez au moins une question avant de publier ce quiz." } });
    expect(await changerStatutLecon(L, true)).toEqual({ ok: false, message: "Ajoutez au moins une question avant de publier ce quiz." });
  });

  it("la formation se publie avec au moins une leçon de contenu publiée : un quiz seul ne suffit pas", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    faux.repondre("modules.select", { data: [{ id: M, lecons: [{ id: L, publiee: true, type: "quiz" }] }] });
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: false, message: "Publiez au moins une leçon avant de publier la formation." });
    expect(faux.de("modules", "select")[0].valeurs).toContain("type");
    // Avant la 0031 : sans le type, toutes les leçons comptent.
    faux.vider();
    faux.repondre("modules.select", (appel) =>
      String(appel.valeurs).includes("type") ? { error: { code: "42703", message: "column lecons.type does not exist" } } : { data: [{ id: M, lecons: [{ id: L, publiee: true }] }] },
    );
    expect(await setStatutFormation(F, "publiee")).toEqual({ ok: true });
  });
});

describe("Le score minimal aux quiz", () => {
  const INFOS = { id: F, titre: "Excel", slug: "excel", resume: "", description: "", objectifs: "", competences: "", niveau: "debutant", espace: "formateur" };

  it("le formateur le règle (0 à 100 %) ; hors limites, refusé ; absent du formulaire, rien n'est envoyé", async () => {
    expect(await saveFormationInfos(IDLE, form({ ...INFOS, score_quiz: "80" }))).toMatchObject({ status: "success" });
    expect(faux.de("formations", "update")[0].valeurs).toMatchObject({ score_quiz: 80 });
    faux.vider();
    expect(await saveFormationInfos(IDLE, form({ ...INFOS, score_quiz: "150" }))).toMatchObject({ status: "error", fieldErrors: { score_quiz: "Score minimal entre 0 et 100 %." } });
    faux.vider();
    await saveFormationInfos(IDLE, form(INFOS));
    expect(faux.de("formations", "update")[0].valeurs).not.toHaveProperty("score_quiz");
  });

  it("avant la 0031 : le reste est enregistré, et le champ dit d'appliquer la migration", async () => {
    faux.repondre("formations.update", (appel) =>
      JSON.stringify(appel.valeurs).includes("score_quiz") ? { error: { code: "PGRST204", message: "Could not find the 'score_quiz' column of 'formations'" } } : {},
    );
    expect(await saveFormationInfos(IDLE, form({ ...INFOS, score_quiz: "80" }))).toMatchObject({ status: "error", fieldErrors: { score_quiz: MIGRATION } });
    expect(faux.de("formations", "update").map((a) => a.valeurs)).toEqual([expect.objectContaining({ score_quiz: 80 }), expect.not.objectContaining({ score_quiz: expect.anything() })]);
  });
});

describe("Les lectures du back-office", () => {
  it("le type de chaque élément du programme et le score minimal de la formation ; avant la 0031, des leçons et pas de score", async () => {
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("type")
        ? {
            data: {
              id: F,
              slug: "excel",
              titre: "Excel",
              statut: "brouillon",
              niveau: "debutant",
              score_quiz: 80,
              modules: [{ id: M, titre: "Module", ordre: 1, lecons: [{ id: L, titre: "Quiz", ordre: 1, type: "quiz", publiee: true }] }],
            },
          }
        : { error: { code: "42703", message: "column lecons.type does not exist" } },
    );
    faux.repondre("rpc.questions_par_quiz", { data: { [L]: 4 } });
    const formation = await getFormationAdmin(F);
    expect(formation).toMatchObject({ scoreQuiz: 80, nbLecons: 0, modules: [{ lecons: [{ id: L, type: "quiz", nbQuestions: 4 }] }] });
    expect(faux.de("rpc", "questions_par_quiz")[0].valeurs).toEqual({ p_formation: F });
    // Avant la 0031 (ou sans droit) : le nombre de questions n'est pas affiché.
    faux.repondre("rpc.questions_par_quiz", { error: { code: "PGRST202", message: "Could not find the function" } });
    expect((await getFormationAdmin(F))?.modules[0].lecons[0]).not.toHaveProperty("nbQuestions");
    faux.vider();
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("score_quiz")
        ? { error: { code: "42703", message: "column formations.score_quiz does not exist" } }
        : { data: { id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [] } },
    );
    expect(await getFormationAdmin(F)).toMatchObject({ scoreQuiz: null });
    faux.vider();
    faux.repondre("lecons.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("type")
        ? { error: { code: "42703", message: "column lecons.type does not exist" } }
        : { data: { id: L, module_id: M, titre: "Leçon", modules: { formation_id: F, formations: { titre: "Excel", slug: "excel", modules: [] } } } },
    );
    expect(await getLeconAdmin(L)).toMatchObject({ id: L, type: "lecon" });
  });

  it("la liste des formations compte les leçons sans les quiz ; avant la 0031, toutes", async () => {
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("type")
        ? { data: [{ id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [{ lecons: [{ id: L, type: "lecon" }, { id: M, type: "quiz" }] }] }] }
        : { data: [{ id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [{ lecons: [{ id: L }, { id: M }] }] }] },
    );
    expect(await listFormations()).toMatchObject([{ nbLecons: 1 }]);
    faux.vider();
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("type")
        ? { error: { code: "42703", message: "column lecons.type does not exist" } }
        : { data: [{ id: F, slug: "excel", titre: "Excel", statut: "brouillon", niveau: "debutant", modules: [{ lecons: [{ id: L }, { id: M }] }] }] },
    );
    expect(await listFormations()).toMatchObject([{ nbLecons: 2 }]);
  });
});
