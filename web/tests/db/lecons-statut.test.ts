import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0027 (refonte des formations, étape A) : le statut d'une leçon (brouillon ou publiée), invisible des
// étudiants tant qu'elle est en brouillon, et le rangement des sections et des leçons, d'une section à l'autre.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiant
let FA: string;
let FB: string;
let PUB: string; // formation publiée de F, gratuite
let M1: string;
let M2: string;
let ANCIENNE: string; // leçon écrite avant la 0027
let AUTRE_MODULE: string; // module d'une formation de G

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const module = async (formation: string, titre: string, ordre: number) =>
  (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, $2, $3) returning id", [formation, titre, ordre])).id;
const lecon = async (moduleId: string, titre: string, ordre: number) => {
  const l = await un<{ id: string }>("insert into public.lecons (module_id, titre, ordre) values ($1, $2, $3) returning id", [moduleId, titre, ordre]);
  await banc.db.query("insert into public.lecons_contenus (lecon_id) values ($1)", [l.id]);
  return l.id;
};
const ordre = async (moduleId: string) =>
  (await banc.db.query<{ titre: string; ordre: number }>("select titre, ordre from public.lecons where module_id = $1 order by ordre", [moduleId])).rows.map((l) => `${l.ordre}:${l.titre}`);
const nouveautes = async (qui: string) =>
  (await un<{ n: number }>("select count(*)::int as n from public.notifications where destinataire = $1 and categorie = 'nouveaux_contenus'", [qui])).n;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    "supabase/migrations/0004_contenus.sql",
    "supabase/migrations/0005_back_office.sql",
    "supabase/migrations/0006_notes.sql",
    "supabase/migrations/0007_visionnage.sql",
    "supabase/migrations/0008_progression.sql",
    "supabase/migrations/0009_favoris.sql",
    "supabase/migrations/0010_avis.sql",
    "supabase/migrations/0011_statistiques.sql",
    "supabase/migrations/0012_couvertures.sql",
    "supabase/migrations/0013_utilisateurs.sql",
    "supabase/migrations/0014_espace_formateur.sql",
    "supabase/migrations/0015_suivi_etudiants.sql",
    "supabase/migrations/0016_notifications.sql",
    "supabase/migrations/0017_role_unique.sql",
    "supabase/migrations/0018_sessions_live.sql",
    "supabase/migrations/0019_communaute.sql",
    "supabase/migrations/0020_moderation.sql",
    "supabase/migrations/0021_communaute_actualites.sql",
    "supabase/migrations/0022_communaute_video.sql",
    "supabase/migrations/0023_sessions_rappels.sql",
    "supabase/migrations/0024_sessions_promotion.sql",
    "supabase/migrations/0025_communaute_commentaires.sql",
    "supabase/migrations/0026_communaute_sondages.sql",
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FB = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [G])).id;
  PUB = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Publiée', 'publiee-0027', $1, true) returning id", [FA])).id;
  M1 = await module(PUB, "Module 1", 1);
  M2 = await module(PUB, "Module 2", 2);
  ANCIENNE = await lecon(M1, "Ancienne", 1);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [PUB]);
  const autre = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Autre', 'autre-0027', $1) returning id", [FB])).id;
  AUTRE_MODULE = await module(autre, "Module de G", 1);
  // L'étudiant suit la formation : il a ouvert la leçon.
  await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, ouverte_le) values ($1, $2, now())", [E, ANCIENNE]);
  await banc.appliquer("supabase/migrations/0027_lecons_statut.sql");
});

describe("Le statut d'une leçon", () => {
  it("les leçons déjà là restent publiées ; une nouvelle naît en brouillon, commentaires activés", async () => {
    expect(await un("select publiee, commentaires_actifs from public.lecons where id = $1", [ANCIENNE])).toEqual({ publiee: true, commentaires_actifs: true });
    const neuve = await lecon(M1, "Neuve", 9);
    expect(await un("select publiee from public.lecons where id = $1", [neuve])).toEqual({ publiee: false });
    await banc.db.query("delete from public.lecons where id = $1", [neuve]);
  });

  it("la 0027 se rejoue sans rien changer : un brouillon reste un brouillon", async () => {
    const brouillon = await lecon(M1, "Reste en brouillon", 8);
    await banc.appliquer("supabase/migrations/0027_lecons_statut.sql");
    expect(await un("select publiee from public.lecons where id = $1", [brouillon])).toEqual({ publiee: false });
    expect(await un("select publiee from public.lecons where id = $1", [ANCIENNE])).toEqual({ publiee: true });
    await banc.db.query("delete from public.lecons where id = $1", [brouillon]);
  });

  it("l'étudiant ne lit ni n'ouvre une leçon en brouillon ; l'équipe et le formateur de la formation, oui ; un autre formateur, non", async () => {
    const brouillon = await lecon(M1, "Brouillon", 2);
    const vues = async (qui: string) => (await banc.en<{ id: string }>({ id: qui }, "select id from public.lecons where id = any($1) order by ordre", [[ANCIENNE, brouillon]])).map((l) => l.id);
    const acces = async (qui: string) => (await banc.en<{ a: boolean }>({ id: qui }, "select public.acces_lecon($1) as a", [brouillon]))[0].a;
    expect(await vues(E)).toEqual([ANCIENNE]);
    expect(await acces(E)).toBe(false);
    expect(await vues(G)).toEqual([ANCIENNE]);
    expect(await acces(G)).toBe(false);
    expect(await vues(F)).toEqual([ANCIENNE, brouillon]);
    expect(await acces(F)).toBe(true);
    expect(await vues(S)).toEqual([ANCIENNE, brouillon]);
    expect((await banc.en<{ id: string }>("anon", "select id from public.lecons where id = $1", [brouillon]))).toEqual([]);
    await banc.db.query("delete from public.lecons where id = $1", [brouillon]);
  });

  it("avis à 50 %, suivi du formateur et fiche d'un compte : seules les leçons publiées comptent", async () => {
    const b1 = await lecon(M2, "Brouillon A", 1);
    const b2 = await lecon(M2, "Brouillon B", 2);
    await banc.db.query("update public.progression_lecons set terminee_le = now() where profil_id = $1 and lecon_id = $2", [E, ANCIENNE]);
    // 1 leçon publiée terminée sur 1 : les avis s'ouvrent (avec les brouillons, 1 sur 3 : non).
    expect((await banc.en<{ p: boolean }>({ id: E }, "select public.peut_donner_avis($1) as p", [PUB]))[0].p).toBe(true);
    const suivi = await un<{ terminees: number; total: number }>("select terminees, total from public.suivi_formateur($1) where etudiant = $2", [FA, E]);
    expect(suivi).toEqual({ terminees: 1, total: 1 });
    const fiche = (await banc.en<{ c: { formations: { total: number }[] } }>({ id: S }, "select public.compte_equipe($1) as c", [E]))[0].c;
    expect(fiche.formations[0].total).toBe(1);
    await banc.db.query("delete from public.lecons where id = any($1)", [[b1, b2]]);
    await banc.db.query("update public.progression_lecons set terminee_le = null where profil_id = $1", [E]);
  });

  it("envoyer en relecture : refusé sans leçon publiée", async () => {
    const brouillon = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Brouillon', 'brouillon-0027', $1) returning id", [FA])).id;
    await lecon(await module(brouillon, "Module", 1), "Pas encore publiée", 1);
    await expect(banc.en({ id: F }, "select public.envoyer_en_relecture($1)", [brouillon])).rejects.toThrow("Publiez au moins une leçon avant d’envoyer la formation en relecture.");
  });

  it("notification « Nouvelle leçon » : pas pour un brouillon, à sa publication, pas à une simple modification", async () => {
    const avant = await nouveautes(E);
    const brouillon = await lecon(M1, "Bientôt", 3);
    expect(await nouveautes(E)).toBe(avant);
    await banc.db.query("update public.lecons set publiee = true where id = $1", [brouillon]);
    expect(await nouveautes(E)).toBe(avant + 1);
    await banc.db.query("update public.lecons set titre = 'Bientôt (corrigée)' where id = $1", [brouillon]);
    expect(await nouveautes(E)).toBe(avant + 1);
    await banc.db.query("delete from public.lecons where id = $1", [brouillon]);
  });
});

describe("Ranger les sections et les leçons", () => {
  it("une leçon vers une autre section, à sa place ; les deux sections renumérotées", async () => {
    const a = await lecon(M1, "A", 2);
    const b = await lecon(M1, "B", 3);
    const x = await lecon(M2, "X", 1);
    await banc.en({ id: F }, "select public.ranger('lecons', $1, $2, 1)", [a, M2]);
    expect(await ordre(M1)).toEqual(["1:Ancienne", "2:B"]);
    expect(await ordre(M2)).toEqual(["1:A", "2:X"]);
    // Dans la même section, en dernier (position au-delà : bornée).
    await banc.en({ id: S }, "select public.ranger('lecons', $1, $2, 99)", [a, M2]);
    expect(await ordre(M2)).toEqual(["1:X", "2:A"]);
    await banc.db.query("delete from public.lecons where id = any($1)", [[a, b, x]]);
  });

  it("refus vers une autre formation ; un autre formateur ne range rien", async () => {
    const a = await lecon(M1, "A", 2);
    await expect(banc.en({ id: F }, "select public.ranger('lecons', $1, $2, 1)", [a, AUTRE_MODULE])).rejects.toThrow("Cette section n’est pas dans la même formation.");
    await banc.en({ id: G }, "select public.ranger('lecons', $1, $2, 1)", [ANCIENNE, M2]);
    expect(await un("select module_id from public.lecons where id = $1", [ANCIENNE])).toEqual({ module_id: M1 });
    await banc.en({ id: G }, "select public.ranger('lecons', $1, $2, 1)", [a, M1]);
    expect(await ordre(M1)).toEqual(["1:Ancienne", "2:A"]);
    await banc.db.query("delete from public.lecons where id = $1", [a]);
  });

  it("une section remonte en tête", async () => {
    await banc.en({ id: F }, "select public.ranger('modules', $1, null, 1)", [M2]);
    const modules = (await banc.db.query<{ titre: string; ordre: number }>("select titre, ordre from public.modules where formation_id = $1 order by ordre", [PUB])).rows;
    expect(modules.map((m) => `${m.ordre}:${m.titre}`)).toEqual(["1:Module 2", "2:Module 1"]);
  });
});
