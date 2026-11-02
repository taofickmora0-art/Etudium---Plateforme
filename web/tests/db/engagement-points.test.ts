import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, MIGRATIONS_ENGAGEMENT, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0063, partie 1 (lot 6 B, spec §2) : la base note chaque jour d'apprentissage et donne les points et les
// badges au moment de l'activité, jamais deux fois pour la même chose.

let banc: Banc;
const S = randomUUID(); // super admin (corrige les rendus)
const E = randomUUID(); // étudiante active
const E2 = randomUUID(); // étudiant sans activité
const E3 = randomUUID(); // étudiante aux certificats
let A: FormationTest; // 2 leçons, un quiz, un exercice simple
let B: FormationTest; // 1 leçon, un exercice à rendre

type Ligne = { raison: string; reference: string; points: number };
const points = async (qui: string) =>
  (await banc.db.query<Ligne>("select raison, reference, points from public.points_gagnes where profil_id = $1 order by id", [qui])).rows;
const total = async (qui: string, raison?: string) => (await points(qui)).filter((l) => !raison || l.raison === raison).reduce((s, l) => s + l.points, 0);
const badges = async (qui: string) =>
  (await banc.db.query<{ badge: string }>("select badge from public.badges_obtenus where profil_id = $1 order by badge", [qui])).rows.map((r) => r.badge);
const aujourdhui = async (qui: string) =>
  (await banc.db.query<{ activites: number; secondes_video: number }>("select activites, secondes_video from public.activite_jours where profil_id = $1 and jour = public.jour_benin(now())", [qui])).rows[0];
const passerQuiz = (qui: string, f: FormationTest, juste: boolean) =>
  banc.en({ id: qui }, "select public.envoyer_quiz($1, $2::jsonb)", [f.quiz, JSON.stringify({ [f.question as string]: [juste ? 0 : 1] })]);

beforeAll(async () => {
  banc = await creerBanc(MIGRATIONS_ENGAGEMENT);
  await banc.creerCompte(S, ["super_admin"]);
  for (const id of [E, E2, E3]) await banc.creerCompte(id);
  A = await creerFormation(banc, "Excel", { exercice: "simple" });
  B = await creerFormation(banc, "Word", { lecons: 1, quiz: false, exercice: "rendu" });
}, 60_000);

describe("Migration 0063 : l'activité du jour", () => {
  it("ouvrir une leçon note le jour et donne 5 points, une seule fois par jour", async () => {
    await banc.en({ id: E }, "select public.ouvrir_lecon($1)", [A.lecons[0]]);
    expect(await aujourdhui(E)).toEqual({ activites: 1, secondes_video: 0 });
    await banc.en({ id: E }, "select public.ouvrir_lecon($1)", [A.lecons[0]]);
    expect((await aujourdhui(E)).activites).toBe(2);
    expect((await points(E)).filter((l) => l.raison === "jour")).toEqual([{ raison: "jour", reference: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), points: 5 }]);
  });

  it("les secondes de vidéo regardées s'ajoutent au jour", async () => {
    await banc.db.query("update public.progression_lecons set passages = '{[0,120)}' where profil_id = $1 and lecon_id = $2", [E, A.lecons[0]]);
    await banc.db.query("update public.progression_lecons set passages = '{[0,180)}' where profil_id = $1 and lecon_id = $2", [E, A.lecons[0]]);
    expect((await aujourdhui(E)).secondes_video).toBe(180);
  });
});

describe("Migration 0063 : les points et les badges", () => {
  it("une leçon terminée : +10 et « Premier pas », jamais deux fois", async () => {
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [A.lecons[0]]);
    expect(await total(E, "lecon")).toBe(10);
    expect(await badges(E)).toContain("premier_pas");
    await banc.db.query("update public.progression_lecons set terminee_le = null where profil_id = $1 and lecon_id = $2", [E, A.lecons[0]]);
    await banc.db.query("update public.progression_lecons set terminee_le = now() where profil_id = $1 and lecon_id = $2", [E, A.lecons[0]]);
    expect(await total(E, "lecon")).toBe(10);
  });

  it("un quiz manqué : une activité, pas de points ; réussi : +20 et « Premier quiz réussi », une fois par quiz", async () => {
    const avant = (await aujourdhui(E)).activites;
    await passerQuiz(E, A, false);
    expect((await aujourdhui(E)).activites).toBe(avant + 1);
    expect(await total(E, "quiz")).toBe(0);
    await passerQuiz(E, A, true);
    expect(await total(E, "quiz")).toBe(20);
    expect(await badges(E)).toContain("premier_quiz");
    await passerQuiz(E, A, true);
    expect(await total(E, "quiz")).toBe(20);
  });

  it("un exercice simple terminé : +30 et « Premier exercice validé »", async () => {
    await banc.en({ id: E }, "select public.terminer_exercice($1)", [A.exercice]);
    expect(await total(E, "exercice")).toBe(30);
    expect(await badges(E)).toContain("premier_exercice");
  });

  it("un rendu : une activité ; validé par la correction : +30, une fois", async () => {
    const rendu = (await banc.db.query<{ id: string }>("insert into public.rendus_exercices (lecon_id, profil_id, version) values ($1, $2, 1) returning id", [B.exercice, E])).rows[0].id;
    expect(await total(E, "exercice")).toBe(30);
    await banc.en({ id: S }, "select public.corriger_rendu($1, 'valide', '')", [rendu]);
    expect(await total(E, "exercice")).toBe(60);
    await banc.db.query("update public.rendus_exercices set statut = 'a_corriger' where id = $1", [rendu]);
    await banc.db.query("update public.rendus_exercices set statut = 'valide' where id = $1", [rendu]);
    expect(await total(E, "exercice")).toBe(60);
  });

  it("un certificat : +100 et « Premier certificat » ; trois : « Trois certificats »", async () => {
    await poserCertificat(banc, E3, A);
    expect(await total(E3, "certificat")).toBe(100);
    expect(await badges(E3)).toEqual(["premier_certificat"]);
    const C = await creerFormation(banc, "Canva", { quiz: false, exercice: null });
    await poserCertificat(banc, E3, B);
    await poserCertificat(banc, E3, C);
    expect(await total(E3, "certificat")).toBe(300);
    expect(await badges(E3)).toEqual(["premier_certificat", "trois_certificats"]);
  });

  it("chacun ne lit que ses lignes et n'écrit rien lui-même", async () => {
    for (const table of ["points_gagnes", "badges_obtenus", "activite_jours"]) {
      expect((await banc.en<{ n: number }>({ id: E2 }, `select count(*)::int as n from public.${table}`))[0].n).toBe(0);
      expect((await banc.en<{ n: number }>({ id: E }, `select count(*)::int as n from public.${table} where profil_id <> $1`, [E]))[0].n).toBe(0);
      expect((await banc.en<{ n: number }>({ id: E }, `select count(*)::int as n from public.${table}`))[0].n).toBeGreaterThan(0);
    }
    await expect(banc.en({ id: E }, "insert into public.points_gagnes (profil_id, raison, reference, points) values ($1, 'lecon', 'x', 10)", [E])).rejects.toThrow(/permission denied/);
    await expect(banc.en({ id: E }, "insert into public.badges_obtenus (profil_id, badge) values ($1, 'serie_30')", [E])).rejects.toThrow(/permission denied/);
    await expect(banc.en({ id: E }, "select public.gagner_points($1, 'lecon', 'x', 10)", [E])).rejects.toThrow(/permission denied/);
  });
});

describe("Migration 0063 : l'objectif de la semaine", () => {
  const objectif = async (qui: string) => (await banc.db.query<{ o: number }>("select objectif_jours as o from public.profils where id = $1", [qui])).rows[0].o;

  it("5 jours par défaut ; 3, 5 ou 7 au choix ; rien d'autre", async () => {
    expect(await objectif(E2)).toBe(5);
    await banc.en({ id: E2 }, "select public.choisir_objectif(7)");
    expect(await objectif(E2)).toBe(7);
    await expect(banc.en({ id: E2 }, "select public.choisir_objectif(4)")).rejects.toThrow("Choisissez 3, 5 ou 7 jours.");
    await expect(banc.en("anon", "select public.choisir_objectif(3)")).rejects.toThrow();
    await expect(banc.en({ id: E2 }, "update public.profils set objectif_jours = 3 where id = $1", [E2])).rejects.toThrow(/permission denied/);
    expect(await objectif(E2)).toBe(7);
  });
});

describe("Migration 0063 : le rattrapage des certificats déjà obtenus", () => {
  it("chaque certificat d'avant donne ses points, datés de sa délivrance, et ses badges ; rejouer ne double rien", async () => {
    const ancien = await creerBanc(migrationsJusqua("0062"));
    const X = randomUUID();
    await ancien.creerCompte(X);
    const f = (await ancien.db.query<{ id: string }>("insert into public.formations (titre, slug, gratuite) values ('Zotero', $1, true) returning id", [randomUUID()])).rows[0].id;
    await ancien.db.query(
      "insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, delivre_le, cree_le) values ('ET-ANCIEN', $1, $2, 'X', 'Zotero', current_date - 10, now() - interval '10 days')",
      [X, f],
    );
    await ancien.appliquer("supabase/migrations/0063_engagement.sql");
    await ancien.appliquer("supabase/migrations/0063_engagement.sql");
    const lignes = (await ancien.db.query<{ points: number; ecart: number }>(
      "select g.points, extract(epoch from (c.cree_le - g.gagne_le))::int as ecart from public.points_gagnes g join public.certificats c on c.id::text = g.reference where g.profil_id = $1",
      [X],
    )).rows;
    expect(lignes).toEqual([{ points: 100, ecart: 0 }]);
    expect((await ancien.db.query("select badge from public.badges_obtenus where profil_id = $1", [X])).rows).toEqual([{ badge: "premier_certificat" }]);
  }, 60_000);
});
