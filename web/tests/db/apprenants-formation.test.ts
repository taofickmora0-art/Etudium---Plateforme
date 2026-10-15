import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0029 : l'onglet « Apprenants » d'une formation (spec 2026-10-15-apprenants-formation-design). Apprenant =
// a ouvert une leçon publiée ; ni le formateur de la formation ni l'équipe ; lu par l'équipe et ce formateur seuls.
const REFUS = /pas l’équipe|n’est pas l’une de vos formations|permission denied/;

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin, ouvre une leçon de X
const F = randomUUID(); // formateur de X
const G = randomUUID(); // autre formateur
const E1 = randomUUID(); // « Fifamè Adjovi » : a terminé X
const E2 = randomUUID(); // « Rodrigue Houngbo » : une leçon il y a 12 jours
const E3 = randomUUID(); // n'a ouvert que la leçon en brouillon
let X: string;
let Z: string;
let leconsX: string[];
let brouillon: string;

type Ligne = { etudiant_id: string; prenom: string; nom: string; terminees: number; total: number; premiere_ouverture: string; derniere_activite: string; etat: string };
type Page = { resume: { apprenants: number; progression_moyenne: number; terminees: number; a_risque: number }; total: number; lignes: Ligne[] };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const progression = (compte: string, lecon: string, il_y_a: string, terminee = false) =>
  banc.db.query(
    `insert into public.progression_lecons (profil_id, lecon_id, vue_le, ouverte_le, terminee_le)
     values ($1, $2, now() - $3::interval, now() - $3::interval, case when $4 then now() - $3::interval end)
     on conflict (profil_id, lecon_id) do update set vue_le = excluded.vue_le, terminee_le = excluded.terminee_le`,
    [compte, lecon, il_y_a, terminee],
  );
const apprenants = async (qui: string, formation: string, recherche = "", etat = "tous", page = 1) =>
  (await banc.en<{ r: Page }>({ id: qui }, "select public.apprenants_formation($1, $2, $3, $4) as r", [formation, recherche, etat, page]))[0].r;
const noms = (p: Page) => p.lignes.map((l) => (l.etudiant_id === E1 ? "E1" : l.etudiant_id === E2 ? "E2" : l.etudiant_id === E3 ? "E3" : "autre"));

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [G, []], [E1, []], [E2, []], [E3, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'Adjovi' where id = $1", [E1]);
  await banc.db.query("update public.profils set prenom = 'Rodrigue', nom = 'Houngbo' where id = $1", [E2]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const formation = async (titre: string, publiees: number, brouillons: number) => {
    const f = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ($1, $2, $3) returning id", [titre, randomUUID(), fiche])).id;
    const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [f])).id;
    const lecons: string[] = [];
    for (let i = 1; i <= publiees + brouillons; i++) {
      lecons.push((await un<{ id: string }>("insert into public.lecons (module_id, titre, ordre, publiee) values ($1, $2, $3, $4) returning id", [m, `Leçon ${i}`, i, i <= publiees])).id);
    }
    await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [f]);
    return [f, lecons] as const;
  };
  let lecons: readonly string[];
  [X, lecons] = await formation("Maîtriser Microsoft Excel", 4, 1);
  leconsX = lecons.slice(0, 4);
  brouillon = lecons[4];
  [Z] = await formation("Sans leçon publiée", 0, 1);
  for (const l of leconsX) await progression(E1, l, "1 day", true);
  await progression(E1, brouillon, "1 day", true);
  await progression(E2, leconsX[0], "12 days");
  await progression(E3, brouillon, "1 hour");
  await progression(F, leconsX[0], "1 hour");
  await progression(A, leconsX[1], "1 hour");
});

describe("Migration 0029 : les apprenants d'une formation", () => {
  it("le formateur de la formation et l'équipe lisent ; ni le formateur ni l'équipe ne sont des apprenants ; une leçon en brouillon ne compte pas", async () => {
    for (const qui of [F, A, S]) {
      const p = await apprenants(qui, X);
      expect(noms(p)).toEqual(["E1", "E2"]);
      expect(p.total).toBe(2);
    }
    const p = await apprenants(F, X);
    expect(p.lignes[0]).toMatchObject({ prenom: "Fifamè", nom: "Adjovi", terminees: 4, total: 4, etat: "terminee" });
    expect(p.lignes[1]).toMatchObject({ prenom: "Rodrigue", nom: "Houngbo", terminees: 0, total: 4, etat: "a_risque" });
    expect(Date.parse(p.lignes[1].premiere_ouverture)).toBeLessThan(Date.now() - 11 * 86_400_000);
    expect(p.lignes[0]).not.toHaveProperty("email");
  });

  it("le résumé porte sur toute la formation : apprenants, progression moyenne, terminée, à risque", async () => {
    expect((await apprenants(F, X, "", "a_risque")).resume).toEqual({ apprenants: 2, progression_moyenne: 50, terminees: 1, a_risque: 1 });
  });

  it("filtres, recherche sans accents ni majuscules, jamais de joker", async () => {
    expect(noms(await apprenants(F, X, "", "a_risque"))).toEqual(["E2"]);
    expect(noms(await apprenants(F, X, "", "terminees"))).toEqual(["E1"]);
    expect(noms(await apprenants(F, X, "fifame"))).toEqual(["E1"]);
    expect(noms(await apprenants(F, X, "HOUNGBO"))).toEqual(["E2"]);
    expect((await apprenants(F, X, "%")).total).toBe(0);
    expect((await apprenants(F, X, "_")).total).toBe(0);
  });

  it("un autre formateur, un étudiant, un visiteur : refus", async () => {
    await expect(apprenants(G, X)).rejects.toThrow(REFUS);
    await expect(apprenants(E1, X)).rejects.toThrow(REFUS);
    await expect(banc.en("anon", "select public.apprenants_formation($1)", [X])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: F }, "select * from public.suivi_formation($1)", [X])).rejects.toThrow(/permission denied/);
  });

  it("une formation sans leçon publiée : personne, 0 %", async () => {
    expect(await apprenants(F, Z)).toEqual({ resume: { apprenants: 0, progression_moyenne: 0, terminees: 0, a_risque: 0 }, total: 0, lignes: [] });
  });

  it("25 lignes par page, les plus récemment actifs d'abord", async () => {
    const autres = Array.from({ length: 24 }, () => randomUUID());
    for (const [i, id] of autres.entries()) {
      await banc.creerCompte(id, []);
      await progression(id, leconsX[2], `${i + 2} hours`);
    }
    const page1 = await apprenants(F, X);
    expect(page1.total).toBe(26);
    expect(page1.lignes).toHaveLength(25);
    expect(page1.lignes[0].etudiant_id).toBe(autres[0]);
    const page2 = await apprenants(F, X, "", "tous", 2);
    expect(noms(page2)).toEqual(["E2"]);
  });
});
