import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, type Banc } from "./banc";
import { creerFormation, MIGRATIONS_ENGAGEMENT, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0063, partie 4 (lot 6 B, §1) : le tableau de bord de l'étudiant en une lecture. Les certificats, ce qu'il y a
// à faire (exercice à corriger, quiz à repasser), l'activité récente, la progression du jeu et les recommandations.

let banc: Banc;
const S = randomUUID();
const [NEUF, PLEIN, ORDRE] = [randomUUID(), randomUUID(), randomUUID()];
let A: FormationTest;

type Tableau = {
  certificats: { nombre: number; titres: string[] };
  a_faire: { type: string; formation: string; slug: string; lecon_id: string; lecon: string }[];
  activite: { type: string; titre: string; formation: string | null; score: number | null; quand: string }[];
  jeu: { niveau: number; serie: number };
  recommandations: { id: string }[];
};
const tableau = async (qui: string) => (await banc.en<{ t: Tableau }>({ id: qui }, "select public.mon_tableau_de_bord() as t"))[0].t;
const passerQuiz = (qui: string, juste: boolean) =>
  banc.en({ id: qui }, "select public.envoyer_quiz($1, $2::jsonb)", [A.quiz, JSON.stringify({ [A.question as string]: [juste ? 0 : 1] })]);

beforeAll(async () => {
  banc = await creerBanc(MIGRATIONS_ENGAGEMENT);
  await banc.creerCompte(S, ["super_admin"]);
  for (const id of [NEUF, PLEIN, ORDRE]) await banc.creerCompte(id);
  A = await creerFormation(banc, "Excel");
  for (const titre of ["Word", "Zotero", "Canva"]) await creerFormation(banc, titre, { quiz: false, exercice: null });
}, 60_000);

describe("Migration 0063 : le tableau de bord", () => {
  it("un compte neuf : rien à faire, aucune activité, niveau 1, des recommandations du catalogue", async () => {
    const t = await tableau(NEUF);
    expect(t).toMatchObject({ certificats: { nombre: 0, titres: [] }, a_faire: [], activite: [], jeu: { niveau: 1, serie: 0 } });
    expect(t.recommandations).toHaveLength(3);
  });

  it("un exercice à corriger et un quiz manqué sont à faire", async () => {
    const rendu = (await banc.db.query<{ id: string }>("insert into public.rendus_exercices (lecon_id, profil_id, version) values ($1, $2, 1) returning id", [A.exercice, PLEIN])).rows[0].id;
    await banc.en({ id: S }, "select public.corriger_rendu($1, 'a_corriger', 'Ajoutez un total.')", [rendu]);
    await passerQuiz(PLEIN, false);
    expect((await tableau(PLEIN)).a_faire).toEqual([
      { type: "exercice", formation: "Excel", slug: A.slug, lecon_id: A.exercice, lecon: "Tableau des ventes" },
      { type: "quiz", formation: "Excel", slug: A.slug, lecon_id: A.quiz, lecon: "Quiz du module 1" },
    ]);
  });

  it("le quiz réussi quitte « à faire » et entre dans l'activité avec son score", async () => {
    await passerQuiz(PLEIN, true);
    const t = await tableau(PLEIN);
    expect(t.a_faire.map((a) => a.type)).toEqual(["exercice"]);
    expect(t.activite[0]).toMatchObject({ type: "quiz", titre: "Quiz du module 1", formation: "Excel", score: 100 });
    expect(t.activite[1]).toMatchObject({ type: "badge", titre: "premier_quiz", formation: null });
  });

  it("l'activité : les 3 plus récentes, de la plus récente à la plus ancienne ; les certificats comptés", async () => {
    await banc.db.query("insert into public.points_gagnes (profil_id, raison, reference, points, gagne_le) values ($1, 'quiz', $2, 20, now() - interval '3 hours')", [ORDRE, A.quiz]);
    await banc.db.query("insert into public.points_gagnes (profil_id, raison, reference, points, gagne_le) values ($1, 'exercice', $2, 30, now() - interval '2 hours')", [ORDRE, A.exercice]);
    await poserCertificat(banc, ORDRE, A, "now() - interval '1 hour'");
    const t = await tableau(ORDRE);
    expect(t.activite.map((a) => [a.type, a.titre])).toEqual([
      ["certificat", "Excel"],
      ["badge", "premier_certificat"],
      ["exercice", "Tableau des ventes"],
    ]);
    expect(t.certificats).toEqual({ nombre: 1, titres: ["Excel"] });
  });

  it("sans compte : refusé", async () => {
    await expect(banc.en("anon", "select public.mon_tableau_de_bord()")).rejects.toThrow();
  });
});
