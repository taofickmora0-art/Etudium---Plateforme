import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, type Banc } from "./banc";
import { MIGRATIONS_ENGAGEMENT } from "./engagement-banc";

// Migration 0063, partie 5 (lot 6 B, Q8) : à 18 h (heure du Bénin), « Votre série de N jours s’arrête ce soir » à qui a
// une série d'au moins 2 jours et n'a encore rien fait ce jour-là. Pas si la préférence est coupée, ni au formateur, ni
// à un compte suspendu ; une seule fois par jour. Sans pg_cron (banc), la migration passe quand même.

let banc: Banc;
const [DEUX, TROIS, UN, AUJ, COUPE, FORM, SUSP] = Array.from({ length: 7 }, () => randomUUID());

const actif = async (qui: string, ...ilYa: number[]) => {
  for (const j of ilYa) await banc.db.query("insert into public.activite_jours (profil_id, jour, activites) values ($1, public.jour_benin(now()) - $2::int, 1)", [qui, j]);
};
const rappels = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string }>("select titre, texte, lien from public.notifications where destinataire = $1 and categorie = 'rappels_apprentissage'", [qui])).rows;
const rappeler = async () => (await banc.db.query<{ n: number }>("select public.rappeler_series() as n")).rows[0].n;

beforeAll(async () => {
  banc = await creerBanc(MIGRATIONS_ENGAGEMENT);
  for (const id of [DEUX, TROIS, UN, AUJ, COUPE, SUSP]) await banc.creerCompte(id);
  await banc.creerCompte(FORM, ["formateur"]);
  await actif(DEUX, 2, 1);
  await actif(TROIS, 3, 2, 1);
  await actif(UN, 1);
  await actif(AUJ, 2, 1, 0);
  await actif(COUPE, 2, 1);
  await actif(FORM, 2, 1);
  await actif(SUSP, 2, 1);
  await banc.db.query("update public.profils set preferences_notifications = preferences_notifications || '{\"rappels_apprentissage\": false}' where id = $1", [COUPE]);
  await banc.db.query("insert into public.suspensions (profil_id, motif) values ($1, 'Test')", [SUSP]);
}, 60_000);

describe("Migration 0063 : le rappel de série de 18 h", () => {
  it("une série d'au moins 2 jours sans activité aujourd'hui : un rappel, une seule fois", async () => {
    expect(await rappeler()).toBe(2);
    expect(await rappels(DEUX)).toEqual([
      { titre: "Votre série de 2 jours s’arrête ce soir", texte: "Une leçon, un quiz ou un exercice aujourd’hui suffit pour la garder.", lien: "/tableau-de-bord" },
    ]);
    expect((await rappels(TROIS)).map((r) => r.titre)).toEqual(["Votre série de 3 jours s’arrête ce soir"]);
    expect(await rappeler()).toBe(0);
    expect(await rappels(DEUX)).toHaveLength(1);
  });

  it("rien pour une série d'un jour, une activité déjà faite aujourd'hui, une préférence coupée, un formateur, un compte suspendu", async () => {
    for (const qui of [UN, AUJ, COUPE, FORM, SUSP]) expect(await rappels(qui)).toEqual([]);
  });

  it("un index sur le jour : le rappel ne relit pas toute l'activité", async () => {
    const index = (await banc.db.query<{ d: string }>("select indexdef as d from pg_indexes where tablename = 'activite_jours'")).rows.map((r) => r.d);
    expect(index.some((d) => /\(jour\)/.test(d))).toBe(true);
  });

  it("les déclencheurs de l'engagement passent avant ceux du certificat (même ordre de verrous partout)", async () => {
    for (const table of ["progression_lecons", "tentatives_quiz", "rendus_exercices"]) {
      const noms = (await banc.db.query<{ n: string }>(
        "select tgname as n from pg_trigger where tgrelid = $1::regclass and not tgisinternal and tgname ~ '(engagement|activite|certificat)' order by tgname",
        [`public.${table}`],
      )).rows.map((r) => r.n);
      expect(noms.length, table).toBeGreaterThanOrEqual(2);
      expect(noms[0], table).toMatch(/activite/);
    }
  });

  it("personne ne peut le déclencher depuis l'appli", async () => {
    await expect(banc.en({ id: DEUX }, "select public.rappeler_series()")).rejects.toThrow(/permission denied/);
  });
});
