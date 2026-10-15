import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lot 3, étape A : la logique des quiz dans l'appli (lectures, envoi), et les comptes de leçons sans les quiz.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { lireQuizAPasser, lireQuizEditeur, lireMesScores, MIGRATION_QUIZ } = await import("@/lib/quiz/data");
const { envoyerQuiz } = await import("@/lib/quiz/actions");
const { etatFormation } = await import("@/lib/progression/regles");
const { getFiche, listCatalogue } = await import("@/lib/catalogue/data");

const L = "11111111-1111-4111-8111-111111111111";
const Q = "22222222-2222-4222-8222-222222222222";
const F = "33333333-3333-4333-8333-333333333333";
const ABSENTE = { error: { code: "PGRST202", message: "Could not find the function" } };

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ roles: ["etudiant"] });
});

describe("Les lectures des quiz", () => {
  it("le quiz à passer, converti ; null sans accès ou avant la 0031", async () => {
    faux.repondre("rpc.quiz_a_passer", { data: { score_minimal: 70, meilleur: null, tentatives: 0, questions: [{ id: Q, genre: "unique", enonce: "Quel outil ?", choix: ["Zotero", "Excel"] }] } });
    expect(await lireQuizAPasser(L)).toEqual({ scoreMinimal: 70, meilleur: null, tentatives: 0, questions: [{ id: Q, genre: "unique", enonce: "Quel outil ?", choix: ["Zotero", "Excel"] }] });
    expect(faux.de("rpc", "quiz_a_passer")[0].valeurs).toEqual({ p_lecon: L });
    faux.vider();
    faux.repondre("rpc.quiz_a_passer", { data: null });
    expect(await lireQuizAPasser(L)).toBeNull();
    faux.vider();
    faux.repondre("rpc.quiz_a_passer", ABSENTE);
    expect(await lireQuizAPasser(L)).toBeNull();
  });

  it("les questions de l'éditeur, avec les bonnes réponses ; la migration manquante est signalée", async () => {
    faux.repondre("rpc.quiz_editeur", {
      data: { questions: [{ id: Q, genre: "courte", enonce: "Quelle fonction ?", choix: [], reponses: ["RECHERCHEX"], explication: "" }] },
    });
    expect(await lireQuizEditeur(L)).toEqual({
      migrationAbsente: false,
      donnees: [{ id: Q, genre: "courte", enonce: "Quelle fonction ?", choix: [], reponses: ["RECHERCHEX"], explication: "" }],
    });
    faux.vider();
    faux.repondre("rpc.quiz_editeur", ABSENTE);
    expect(await lireQuizEditeur(L)).toEqual({ migrationAbsente: true });
    expect(MIGRATION_QUIZ).toBe("Appliquez la migration 0031 (guide « Ce qui te revient », section 37).");
  });

  it("les meilleurs scores d'une formation ; vide avant la 0031", async () => {
    faux.repondre("rpc.mes_scores_quiz", { data: { [L]: 75 } });
    expect(await lireMesScores(F)).toEqual({ [L]: 75 });
    faux.vider();
    faux.repondre("rpc.mes_scores_quiz", ABSENTE);
    expect(await lireMesScores(F)).toEqual({});
  });
});

describe("Envoyer un quiz", () => {
  it("les réponses partent à la base ; le résultat revient converti", async () => {
    faux.repondre("rpc.envoyer_quiz", {
      data: {
        score: 75,
        bonnes: 3,
        total: 4,
        reussi: true,
        meilleur: 75,
        numero: 1,
        score_minimal: 70,
        detail: [{ question_id: Q, enonce: "Vrai ou faux ?", genre: "vrai_faux", votre_reponse: "Vrai", correcte: false, bonne_reponse: "Faux", explication: "Parce que." }],
      },
    });
    expect(await envoyerQuiz(L, { [Q]: [0] })).toEqual({
      ok: true,
      resultat: {
        score: 75,
        bonnes: 3,
        total: 4,
        reussi: true,
        meilleur: 75,
        numero: 1,
        scoreMinimal: 70,
        detail: [{ questionId: Q, enonce: "Vrai ou faux ?", genre: "vrai_faux", votreReponse: "Vrai", correcte: false, bonneReponse: "Faux", explication: "Parce que." }],
      },
    });
    expect(faux.de("rpc", "envoyer_quiz")[0].valeurs).toEqual({ p_lecon: L, p_reponses: { [Q]: [0] } });
  });

  it("refus : sans compte, identifiant mal formé (sans appel), message de la base, migration absente", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await envoyerQuiz(L, {})).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await envoyerQuiz("pas-un-id", {})).toEqual({ ok: false, message: "Le quiz n’a pas pu être envoyé. Réessayez." });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.envoyer_quiz", { error: { code: "42501", message: "Ce quiz ne vous est pas ouvert." } });
    expect(await envoyerQuiz(L, {})).toEqual({ ok: false, message: "Ce quiz ne vous est pas ouvert." });
    faux.vider();
    faux.repondre("rpc.envoyer_quiz", { error: { code: "P0001", message: "Trop de tentatives en peu de temps : réessayez dans quelques minutes." } });
    expect(await envoyerQuiz(L, {})).toEqual({ ok: false, message: "Trop de tentatives en peu de temps : réessayez dans quelques minutes." });
    faux.vider();
    faux.repondre("rpc.envoyer_quiz", ABSENTE);
    expect(await envoyerQuiz(L, {})).toEqual({ ok: false, message: "Appliquez la migration 0031 (guide « Ce qui te revient », section 37)." });
  });
});

describe("Les quiz ne comptent pas comme des leçons", () => {
  it("la progression ignore les quiz", () => {
    const fiche = { id: F, modules: [{ id: "m1", titre: "Module", lecons: [
      { id: "l1", titre: "Leçon", dureeSecondes: 600, apercu: false, accessible: true },
      { id: "q1", titre: "Quiz", dureeSecondes: 0, apercu: false, accessible: true, type: "quiz" as const },
    ] }] };
    const etat = etatFormation(fiche, [{ leconId: "l1", formationId: F, termineeLe: "2026-10-15T08:00:00Z", vueLe: "2026-10-15T08:00:00Z", positionSecondes: 0 }]);
    expect(etat).toMatchObject({ pourcentage: 100, total: 1, terminee: true });
  });

  it("la fiche et le catalogue : « n leçons » et la durée sans les quiz ; le nombre de quiz à part ; avant la 0031, sans le type", async () => {
    faux.repondre("formations.select", (appel) => {
      if (!String(appel.valeurs).includes("type")) return { data: [] };
      return {
        data: [
          {
            id: F,
            slug: "excel",
            titre: "Excel",
            resume: "",
            niveau: "debutant",
            publiee_le: null,
            formations_parcours: [],
            modules: [{ lecons: [{ duree_secondes: 600, type: "lecon" }, { duree_secondes: 0, type: "quiz" }] }],
          },
        ],
      };
    });
    expect(await listCatalogue()).toMatchObject([{ nbLecons: 1, nbQuiz: 1, dureeSecondes: 600 }]);
    faux.vider();
    faux.repondre("formations.select", (appel) =>
      String(appel.valeurs).includes("type")
        ? { error: { code: "42703", message: "column lecons.type does not exist" } }
        : {
            data: {
              id: F,
              slug: "excel",
              titre: "Excel",
              resume: "",
              niveau: "debutant",
              publiee_le: null,
              formations_parcours: [],
              description: "",
              objectifs: [],
              competences: [],
              modules: [{ id: "m1", titre: "Module", ordre: 1, lecons: [{ id: "l1", titre: "Leçon", duree_secondes: 600, apercu: false, ordre: 1, accessible: true }] }],
            },
          },
    );
    const fiche = await getFiche("excel");
    expect(fiche).toMatchObject({ nbLecons: 1, nbQuiz: 0, modules: [{ lecons: [{ id: "l1", type: "lecon" }] }] });
  });
});
