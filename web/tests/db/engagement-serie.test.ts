import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, type Banc } from "./banc";
import { MIGRATIONS_ENGAGEMENT } from "./engagement-banc";

// Migration 0063, partie 2 (lot 6 B, Q2, Q3 et Q5) : la série d'apprentissage, les points de la semaine, le niveau et
// les jours de la semaine, rendus par ma_progression_jeu(). Critère 6.4 : une série de 3 jours s'affiche correctement.

let banc: Banc;

type Jeu = {
  serie: number;
  points_total: number;
  points_semaine: number;
  niveau: number;
  points_avant_niveau: number;
  objectif_jours: number;
  jours_semaine: boolean[];
  badges: { code: string; obtenu_le: string }[];
};

const jeu = async (qui: string) => (await banc.en<{ j: Jeu }>({ id: qui }, "select public.ma_progression_jeu() as j"))[0].j;
const compte = async () => {
  const id = randomUUID();
  await banc.creerCompte(id);
  return id;
};
/** Une activité il y a `ilYa` jours (heure du Bénin). */
const actif = (qui: string, ilYa: number) =>
  banc.db.query("insert into public.activite_jours (profil_id, jour, activites) values ($1, public.jour_benin(now()) - $2::int, 1)", [qui, ilYa]);
const gagner = (qui: string, points: number, quand = "now()") =>
  banc.db.query(`insert into public.points_gagnes (profil_id, raison, reference, points, gagne_le) values ($1, 'lecon', $2, $3, ${quand})`, [qui, randomUUID(), points]);
const LUNDI = "(date_trunc('week', public.jour_benin(now())::timestamp) at time zone 'Africa/Porto-Novo')";

beforeAll(async () => {
  banc = await creerBanc(MIGRATIONS_ENGAGEMENT);
}, 60_000);

describe("Migration 0063 : la série d'apprentissage", () => {
  it("trois jours d'affilée jusqu'à aujourd'hui : 3", async () => {
    const qui = await compte();
    for (const j of [2, 1, 0]) await actif(qui, j);
    expect((await jeu(qui)).serie).toBe(3);
  });

  it("hier et avant-hier, rien encore aujourd'hui : la série tient encore (2)", async () => {
    const qui = await compte();
    for (const j of [2, 1]) await actif(qui, j);
    expect((await jeu(qui)).serie).toBe(2);
  });

  it("un jour entier sans activité la remet à 0", async () => {
    const qui = await compte();
    for (const j of [3, 2]) await actif(qui, j);
    expect((await jeu(qui)).serie).toBe(0);
  });

  it("un trou dans le passé ne compte pas : seuls les jours d'affilée les plus récents", async () => {
    const qui = await compte();
    for (const j of [5, 4, 1, 0]) await actif(qui, j);
    expect((await jeu(qui)).serie).toBe(2);
  });

  it("le jour change à minuit au Bénin (23 h UTC)", async () => {
    const jour = async (moment: string) => (await banc.db.query<{ j: string }>("select public.jour_benin($1::timestamptz)::text as j", [moment])).rows[0].j;
    expect(await jour("2026-11-02T22:30:00Z")).toBe("2026-11-02");
    expect(await jour("2026-11-02T23:30:00Z")).toBe("2026-11-03");
  });

  it("trois jours d'apprentissage réels donnent le badge « Série de 3 jours »", async () => {
    const qui = await compte();
    for (const j of [2, 1, 0]) await banc.db.query("select public.noter_activite($1, 0, public.jour_benin(now()) - $2::int)", [qui, j]);
    const j = await jeu(qui);
    expect(j.serie).toBe(3);
    expect(j.badges.map((b) => b.code)).toEqual(["serie_3"]);
    expect(j.points_total).toBe(15);
  });
});

describe("Migration 0063 : le niveau et les points", () => {
  it("un niveau tous les 200 points", async () => {
    for (const [points, niveau, encore] of [
      [0, 1, 200],
      [199, 1, 1],
      [200, 2, 200],
      [450, 3, 150],
    ]) {
      const qui = await compte();
      if (points > 0) await gagner(qui, points);
      expect(await jeu(qui)).toMatchObject({ points_total: points, niveau, points_avant_niveau: encore });
    }
  });

  it("les points de la semaine : depuis lundi 0 h au Bénin", async () => {
    const qui = await compte();
    await gagner(qui, 20, `${LUNDI} + interval '1 minute'`);
    await gagner(qui, 30, `${LUNDI} - interval '1 minute'`);
    expect(await jeu(qui)).toMatchObject({ points_semaine: 20, points_total: 50 });
  });

  it("les jours de la semaine, du lundi au dimanche", async () => {
    const qui = await compte();
    await banc.db.query("insert into public.activite_jours (profil_id, jour, activites) values ($1, date_trunc('week', public.jour_benin(now())::timestamp)::date, 1)", [qui]);
    expect((await jeu(qui)).jours_semaine).toEqual([true, false, false, false, false, false, false]);
  });

  it("un compte neuf : tout à zéro, niveau 1, objectif 5 jours ; sans compte : refusé", async () => {
    const qui = await compte();
    expect(await jeu(qui)).toEqual({
      serie: 0,
      points_total: 0,
      points_semaine: 0,
      niveau: 1,
      points_avant_niveau: 200,
      objectif_jours: 5,
      jours_semaine: [false, false, false, false, false, false, false],
      badges: [],
    });
    await expect(banc.en("anon", "select public.ma_progression_jeu()")).rejects.toThrow();
  });
});
