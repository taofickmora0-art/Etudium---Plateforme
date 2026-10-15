import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lot 3, étape B : créer un exercice, choisir son genre, le lire au back-office ; compter les exercices sur la fiche.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { addLecon, saveLecon } = await import("@/lib/admin/actions");
const { getFormationAdmin, getLeconAdmin } = await import("@/lib/admin/data");
const { listCatalogue } = await import("@/lib/catalogue/data");
const { IDLE } = await import("@/lib/auth/schemas");

const F = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const L = "33333333-3333-4333-8333-333333333333";
const MIGRATION = "Appliquez la migration 0032 (guide « Ce qui te revient », section 38).";
const form = (valeurs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
  return fd;
};

beforeEach(() => {
  faux.vider();
  getShellUser.mockReset().mockResolvedValue({ roles: ["etudiant", "formateur"] });
});

describe("Créer un exercice", () => {
  it("« Nouvelle leçon » de type exercice : créé en brouillon, « avec rendu » ; avant la 0032, le message de la migration", async () => {
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: null } } });
    faux.repondre("lecons.insert", { data: { id: L } });
    expect(await addLecon(IDLE, form({ module_id: M, titre: "Tableau des ventes", type: "exercice", espace: "formateur" }))).toMatchObject({ status: "success" });
    expect(faux.de("lecons", "insert")[0].valeurs).toMatchObject({ titre: "Tableau des ventes", type: "exercice", genre_exercice: "rendu", publiee: false });
    faux.vider();
    faux.repondre("modules.select", { data: { formation_id: F, formations: { publiee_le: null } } });
    faux.repondre("lecons.insert", { error: { code: "PGRST204", message: "Could not find the 'genre_exercice' column of 'lecons'" } });
    expect(await addLecon(IDLE, form({ module_id: M, titre: "Exercice", type: "exercice" }))).toMatchObject({ status: "error", message: MIGRATION });
  });

  it("enregistrer un exercice : son genre part avec la leçon ; un genre inconnu n'est pas envoyé", async () => {
    const saisie = { id: L, titre: "Nettoyer une enquête", titre_court: "", duree: "0:00", video: "", resume: "", points_cles: "", texte: "La consigne." };
    expect(await saveLecon(IDLE, form({ ...saisie, genre_exercice: "simple" }))).toMatchObject({ status: "success" });
    expect(faux.de("lecons", "update")[0].valeurs).toMatchObject({ genre_exercice: "simple" });
    faux.vider();
    await saveLecon(IDLE, form({ ...saisie, genre_exercice: "autre" }));
    expect(faux.de("lecons", "update")[0].valeurs).not.toHaveProperty("genre_exercice");
  });
});

describe("Les lectures", () => {
  it("le back-office lit le genre de chaque exercice ; la fiche compte les exercices à part", async () => {
    faux.repondre("formations.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("genre_exercice")
        ? {
            data: {
              id: F,
              slug: "excel",
              titre: "Excel",
              statut: "brouillon",
              niveau: "debutant",
              score_quiz: 70,
              modules: [{ id: M, titre: "Module", ordre: 1, lecons: [{ id: L, titre: "Tableau", ordre: 1, type: "exercice", genre_exercice: "simple", publiee: true }] }],
            },
          }
        : { error: { code: "42703", message: "column lecons.genre_exercice does not exist" } },
    );
    expect(await getFormationAdmin(F)).toMatchObject({ nbLecons: 0, modules: [{ lecons: [{ id: L, type: "exercice", genreExercice: "simple" }] }] });
    faux.vider();
    faux.repondre("lecons.select", (appel) =>
      JSON.stringify(appel.valeurs).includes("genre_exercice")
        ? { data: { id: L, module_id: M, titre: "Tableau", type: "exercice", genre_exercice: "rendu", modules: { formation_id: F, formations: { titre: "Excel", slug: "excel", modules: [] } } } }
        : { error: { code: "42703", message: "column lecons.genre_exercice does not exist" } },
    );
    expect(await getLeconAdmin(L)).toMatchObject({ type: "exercice", genreExercice: "rendu" });
    faux.vider();
    faux.repondre("formations.select", {
      data: [
        {
          id: F,
          slug: "excel",
          titre: "Excel",
          resume: "",
          niveau: "debutant",
          publiee_le: null,
          formations_parcours: [],
          modules: [{ lecons: [{ duree_secondes: 600, type: "lecon" }, { duree_secondes: 0, type: "exercice" }, { duree_secondes: 0, type: "exercice" }] }],
        },
      ],
    });
    expect(await listCatalogue()).toMatchObject([{ nbLecons: 1, nbQuiz: 0, nbExercices: 2 }]);
  });
});
