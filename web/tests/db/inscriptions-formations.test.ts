import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0069 : l'inscription aux formations (spec du 2 novembre 2026, §2 et §9). Une leçon qui n'est pas un aperçu
// exige, pour l'étudiant, l'inscription à sa formation ; on ne s'inscrit qu'à une formation ouverte (gratuite, ou avec
// un abonnement). Les comptes qui avaient déjà commencé une formation y sont inscrits. La messagerie suit l'inscription.

const MIGRATION = "supabase/migrations/0069_inscriptions_formations.sql";

let banc: Banc;
const [S, A, F, G, E, AB, EX, SU, X, R1, R2, Q, RE, M, P, W, W2, N] = Array.from({ length: 18 }, () => randomUUID());
// S : super admin ; A : admin (équipe des contenus) ; F : formateur de « payante », « gratuite », « zotero » et
// « powerpoint » ; G : autre formateur ; E : étudiante sans abonnement ; AB : abonnée ; EX : abonnement expiré ; SU :
// bientôt suspendue ; X : n'ouvre qu'un aperçu ; R1, R2 : avaient commencé avant la 0069 ; Q : n'avait passé qu'un quiz ;
// RE : n'avait rendu qu'un exercice ; M : modératrice ; P : étudiant devenu formateur ; W, W2 : inscrits, puis modérateur et formateur ; N : inscrite à
// 0 % (les notifications).
let payante: FormationTest; // payante ; sa première leçon est un aperçu
let gratuite: FormationTest;
let autre: FormationTest; // de G
let brouillon: FormationTest;
let zotero: FormationTest; // gratuite, avec un quiz et un exercice à rendre
let powerpoint: FormationTest; // gratuite, pour les notifications

const r = async <T>(qui: string | "anon", sql: string, params: unknown[] = []) =>
  (await banc.en<{ r: T }>(qui === "anon" ? "anon" : { id: qui }, sql, params))[0].r;
const acces = (qui: string | "anon", lecon: string) => r<boolean>(qui, "select public.acces_lecon($1) as r", [lecon]);
const ouverte = (qui: string | "anon", formation: FormationTest) => r<boolean>(qui, "select public.formation_ouverte($1) as r", [formation.id]);
const inscrit = (qui: string | "anon", formation: FormationTest) => r<boolean>(qui, "select public.inscrit_formation($1) as r", [formation.id]);
const inscrire = (qui: string | "anon", formation: FormationTest | string) =>
  r<Date>(qui, "select public.s_inscrire_formation($1) as r", [typeof formation === "string" ? formation : formation.id]);
const inscriptions = async (formation?: FormationTest) =>
  (await banc.db.query<{ profil_id: string; formation_id: string; inscrit_le: Date }>(
    "select profil_id, formation_id, inscrit_le from public.inscriptions_formations where $1::uuid is null or formation_id = $1 order by inscrit_le",
    [formation?.id ?? null],
  )).rows;
const suit = async (etudiant: string, formateur: string) =>
  (await banc.db.query<{ r: boolean }>("select public.suit_formation_de($1, $2) as r", [etudiant, formateur])).rows[0].r;
const contacts = (qui: string, espace: "etudiant" | "formateur") => r<{ id: string; formation: string }[]>(qui, "select public.contacts_messagerie($1, '') as r", [espace]);
const apprenants = async (qui: string | "anon") =>
  Object.fromEntries(
    (await banc.en<{ formation_id: string; apprenants: number }>(qui === "anon" ? "anon" : { id: qui }, "select formation_id, apprenants from public.apprenants_formations()")).map((x) => [
      x.formation_id,
      x.apprenants,
    ]),
  );
const progression = (profil: string, lecon: string, ouverteLe: string) =>
  banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, ouverte_le, vue_le) values ($1, $2, $3, $3)", [profil, lecon, ouverteLe]);

beforeAll(async () => {
  // Le banc s'arrête à la 0068 : la progression d'avant l'inscription y est posée, puis la 0069 est appliquée.
  banc = await creerBanc(migrationsJusqua("0068"));
  await banc.creerCompte(S, ["super_admin"]);
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(M, ["moderateur"]);
  for (const id of [F, G, E, AB, EX, SU, X, R1, R2, Q, RE, P, W, W2, N]) await banc.creerCompte(id);
  for (const id of [F, G]) await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [id]);
  const fiche = async (compte: string) => (await banc.db.query<{ id: string }>("select id from public.formateurs where compte_id = $1", [compte])).rows[0].id;
  const [FF, FG] = [await fiche(F), await fiche(G)];
  const sans = { quiz: false, exercice: null } as const;
  payante = await creerFormation(banc, "Excel avancé", { ...sans, gratuite: false, apercu: true, formateur: FF });
  gratuite = await creerFormation(banc, "Word", { ...sans, formateur: FF });
  autre = await creerFormation(banc, "Canva", { ...sans, formateur: FG });
  brouillon = await creerFormation(banc, "Brouillon", { ...sans, statut: "brouillon" });
  zotero = await creerFormation(banc, "Zotero", { formateur: FF });
  powerpoint = await creerFormation(banc, "PowerPoint", { ...sans, formateur: FF });
  await abonner(banc, AB);
  await abonner(banc, EX, { debut: "now() - interval '3 months'", fin: "now() - interval '1 minute'" });

  // Avant la 0069 : R1 a ouvert deux leçons de « gratuite » (le 1er puis le 11 octobre) et obtenu son certificat le 20 ;
  // R2 n'a qu'un certificat de « payante », du 5 octobre.
  await progression(R1, gratuite.lecons[1], "2026-10-11 09:00:00+00");
  await progression(R1, gratuite.lecons[0], "2026-10-01 09:00:00+00");
  await poserCertificat(banc, R1, gratuite, "'2026-10-20 09:00:00+00'::timestamptz");
  await poserCertificat(banc, R2, payante, "'2026-10-05 09:00:00+00'::timestamptz");
  // Q n'a passé que le quiz de « zotero » (le 3 octobre), RE n'a rendu que son exercice (le 4) ; l'admin A, la
  // modératrice M et P (étudiant devenu formateur depuis) avaient ouvert une leçon de « gratuite ».
  await banc.db.query("insert into public.tentatives_quiz (profil_id, lecon_id, numero, bonnes, total, score, cree_le) values ($1, $2, 1, 1, 1, 100, $3)", [
    Q,
    zotero.quiz,
    "2026-10-03 09:00:00+00",
  ]);
  await banc.db.query("insert into public.rendus_exercices (lecon_id, profil_id, version, cree_le) values ($1, $2, 1, $3)", [zotero.exercice, RE, "2026-10-04 09:00:00+00"]);
  for (const qui of [A, M, P]) await progression(qui, gratuite.lecons[0], "2026-10-02 09:00:00+00");
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [P]);

  await banc.appliquer(MIGRATION);
}, 60_000);

describe("Migration 0069 : le rattrapage", () => {
  it("qui avait commencé une formation (progression ou certificat) y est inscrit, à la date de sa première ouverture", async () => {
    expect((await inscriptions(gratuite)).map((i) => [i.profil_id, i.inscrit_le.toISOString()])).toEqual([[R1, "2026-10-01T09:00:00.000Z"]]);
    expect((await inscriptions(payante)).map((i) => [i.profil_id, i.inscrit_le.toISOString()])).toEqual([[R2, "2026-10-05T09:00:00.000Z"]]);
    expect(await inscriptions(autre)).toEqual([]);
    expect(await acces(R1, gratuite.lecons[1])).toBe(true);
  });

  it("un quiz passé ou un exercice rendu suffit : le compte est inscrit à leur date, et son quiz reste ouvert", async () => {
    expect((await inscriptions(zotero)).map((i) => [i.profil_id, i.inscrit_le.toISOString()])).toEqual([
      [Q, "2026-10-03T09:00:00.000Z"],
      [RE, "2026-10-04T09:00:00.000Z"],
    ]);
    expect(await acces(Q, zotero.quiz!)).toBe(true);
    expect(await acces(RE, zotero.exercice!)).toBe(true);
    expect(await acces(Q, zotero.lecons[1])).toBe(true);
  });

  it("l'équipe (modératrice comprise) et les formateurs qui avaient ouvert des leçons ne sont pas inscrits (règle de la 0029)", async () => {
    for (const qui of [A, M, P]) expect(await inscrit(qui, gratuite)).toBe(false);
    expect((await inscriptions()).filter((i) => ([A, M, P, S, F, G] as string[]).includes(i.profil_id))).toEqual([]);
  });

  it("à la fin d'un abonnement, l'inscription reste mais les leçons payantes se ferment", async () => {
    expect(await inscrit(R2, payante)).toBe(true);
    expect(await acces(R2, payante.lecons[1])).toBe(false);
  });
});

describe("Migration 0069 : l'inscription ouvre les leçons", () => {
  it("abonnée non inscrite : la formation lui est ouverte, mais seules les leçons d'aperçu s'ouvrent", async () => {
    expect(await ouverte(AB, payante)).toBe(true);
    expect(await inscrit(AB, payante)).toBe(false);
    expect(await acces(AB, payante.lecons[1])).toBe(false);
    expect(await acces(AB, payante.lecons[0])).toBe(true);
    // L'aperçu reste ouvert aux visiteurs.
    expect(await acces("anon", payante.lecons[0])).toBe(true);
    expect(await acces("anon", payante.lecons[1])).toBe(false);
  });

  it("une fois inscrite, la leçon s'ouvre ; rejouer l'inscription ne la double pas", async () => {
    const le = await inscrire(AB, payante);
    expect(le).toBeInstanceOf(Date);
    expect(await inscrit(AB, payante)).toBe(true);
    expect(await acces(AB, payante.lecons[1])).toBe(true);
    await banc.en({ id: AB }, "select public.ouvrir_lecon($1)", [payante.lecons[1]]);

    expect((await inscrire(AB, payante)).toISOString()).toBe(le.toISOString());
    expect((await inscriptions(payante)).filter((i) => i.profil_id === AB)).toHaveLength(1);
  });

  it("formation gratuite, sans abonnement : l'inscription est possible et ouvre les leçons", async () => {
    expect(await ouverte(E, gratuite)).toBe(true);
    expect(await acces(E, gratuite.lecons[0])).toBe(false);
    await inscrire(E, gratuite);
    expect(await acces(E, gratuite.lecons[0])).toBe(true);
  });

  it("formation payante, sans abonnement : l'inscription est refusée", async () => {
    expect(await ouverte(E, payante)).toBe(false);
    await expect(inscrire(E, payante)).rejects.toThrow(/abonnement/);
    await expect(inscrire(EX, payante)).rejects.toThrow(/abonnement/);
    expect(await inscrit(E, payante)).toBe(false);
  });

  it("refusée aussi : visiteur, formateur, équipe des contenus, compte suspendu, formation non publiée ou inconnue", async () => {
    await expect(inscrire("anon", gratuite)).rejects.toThrow();
    await expect(inscrire(F, gratuite)).rejects.toThrow(/formateur/);
    await expect(inscrire(G, gratuite)).rejects.toThrow(/formateur/);
    await expect(inscrire(A, gratuite)).rejects.toThrow("L’équipe a déjà accès à toutes les formations.");
    await expect(inscrire(S, payante)).rejects.toThrow("L’équipe a déjà accès à toutes les formations.");
    await expect(inscrire(E, brouillon)).rejects.toThrow(/disponible/);
    await expect(inscrire(E, randomUUID())).rejects.toThrow(/disponible/);
    expect(await ouverte("anon", gratuite)).toBe(false);
    expect(await ouverte(E, brouillon)).toBe(false);
    expect(await inscrit("anon", gratuite)).toBe(false);

    // Suspendue : plus d'inscription, et plus d'accès à ce qu'elle suivait.
    await inscrire(SU, gratuite);
    expect(await acces(SU, gratuite.lecons[0])).toBe(true);
    await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [SU, S]);
    await expect(inscrire(SU, autre)).rejects.toThrow(/suspendu/);
    expect(await acces(SU, gratuite.lecons[0])).toBe(false);
    expect(await ouverte(SU, gratuite)).toBe(false);

    const refuses = (await inscriptions()).filter((i) => ([F, G, A, S] as string[]).includes(i.profil_id) || i.formation_id === brouillon.id);
    expect(refuses).toEqual([]);
  });

  it("l'équipe des contenus et le formateur de la formation ouvrent tout sans inscription ; pas un autre formateur", async () => {
    expect(await acces(A, payante.lecons[1])).toBe(true);
    expect(await acces(F, payante.lecons[1])).toBe(true);
    expect(await acces(G, payante.lecons[1])).toBe(false);
    expect(await ouverte(A, payante)).toBe(true);
    expect(await ouverte(F, payante)).toBe(true);
    expect(await ouverte(G, payante)).toBe(false);
    expect(await ouverte(A, brouillon)).toBe(true);
  });
});

describe("Migration 0069 : la table des inscriptions", () => {
  it("chacun lit les siennes, l'équipe des contenus toutes ; personne ne les écrit directement", async () => {
    const lues = async (qui: string) => (await banc.en<{ profil_id: string }>({ id: qui }, "select profil_id from public.inscriptions_formations")).map((x) => x.profil_id);
    expect(await lues(E)).toEqual([E]);
    expect((await lues(A)).sort()).toEqual((await inscriptions()).map((i) => i.profil_id).sort());
    expect(await lues(F)).toEqual([]);
    await expect(banc.en("anon", "select * from public.inscriptions_formations")).rejects.toThrow();

    await expect(banc.en({ id: E }, "insert into public.inscriptions_formations (profil_id, formation_id) values ($1, $2)", [E, autre.id])).rejects.toThrow();
    await expect(banc.en({ id: A }, "insert into public.inscriptions_formations (profil_id, formation_id) values ($1, $2)", [A, autre.id])).rejects.toThrow();
    await expect(banc.en({ id: E }, "delete from public.inscriptions_formations where profil_id = $1", [E])).rejects.toThrow();
    expect(await inscrit(E, gratuite)).toBe(true);
  });

  it("apprenants_formations : le nombre d'inscrits des formations publiées, lisible par un visiteur", async () => {
    const attendu = { [payante.id]: 2, [gratuite.id]: 3, [autre.id]: 0, [zotero.id]: 2, [powerpoint.id]: 0 };
    expect(await apprenants("anon")).toEqual(attendu);
    expect(await apprenants(E)).toEqual(attendu);
  });

  it("apprenants_formations ne compte ni l'équipe ni les formateurs (règle de la 0029), même inscrits", async () => {
    for (const qui of [W, W2]) await inscrire(qui, autre);
    expect((await apprenants("anon"))[autre.id]).toBe(2);
    await banc.en({ id: S }, "select public.changer_role($1, 'moderateur')", [W]);
    await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [W2]);
    expect(await inscrit(W, autre)).toBe(true);
    expect((await apprenants("anon"))[autre.id]).toBe(0);
  });
});

describe("Migration 0069 : la messagerie suit l'inscription", () => {
  it("un aperçu ouvert ne suffit plus pour écrire au formateur ; l'inscription, si", async () => {
    await banc.en({ id: X }, "select public.ouvrir_lecon($1)", [payante.lecons[0]]);
    expect(await suit(X, F)).toBe(false);
    await expect(banc.en({ id: X }, "select public.ouvrir_conversation($1)", [F])).rejects.toThrow();
    expect((await contacts(X, "etudiant")).map((c) => c.id)).toEqual([]);

    expect(await suit(E, F)).toBe(true);
    expect(await suit(E, G)).toBe(false);
    expect((await contacts(E, "etudiant")).map((c) => [c.id, c.formation])).toEqual([[F, "Word"]]);
    expect(await banc.en({ id: E }, "select public.ouvrir_conversation($1) as id", [F])).toHaveLength(1);

    const deF = (await contacts(F, "formateur")).map((c) => c.id);
    expect(deF).toEqual(expect.arrayContaining([E, AB, R1, R2]));
    expect(deF).not.toContain(X);
  });
});

describe("Migration 0069 : les inscrits sont prévenus, même à 0 %", () => {
  const notifications = async (qui: string) =>
    (await banc.db.query<{ titre: string }>("select titre from public.notifications where destinataire = $1 order by id", [qui])).rows.map((n) => n.titre);

  it("une nouvelle leçon (suiveurs_formation), puis la désactivation (suiveurs_actifs_formation) : l'inscrite à 0 % est prévenue", async () => {
    await inscrire(N, powerpoint);
    await banc.db.query("delete from public.notifications");
    await banc.db.query("delete from public.envois");

    const idModule = (await banc.db.query<{ id: string }>("select id from public.modules where formation_id = $1", [powerpoint.id])).rows[0].id;
    const lecon = (
      await banc.db.query<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, 'Les animations', 'lecon', false, 9) returning id", [idModule])
    ).rows[0].id;
    await banc.db.query("update public.lecons set publiee = true where id = $1", [lecon]);
    expect(await notifications(N)).toEqual(["Nouvelle leçon dans PowerPoint"]);

    expect((await banc.en<{ n: number }>({ id: S }, "select public.nombre_suiveurs_formation($1) as n", [powerpoint.id]))[0].n).toBe(1);
    await banc.en({ id: S }, "update public.formations set statut = 'desactivee'::text::public.statut_formation where id = $1", [powerpoint.id]);
    expect(await notifications(N)).toEqual(["Nouvelle leçon dans PowerPoint", "« PowerPoint » est momentanément indisponible"]);
    const emails = await banc.db.query<{ destinataire: string }>("select destinataire from public.envois where canal = 'email' and titre like '%indisponible'");
    expect(emails.rows).toEqual([{ destinataire: N }]);
  });
});

describe("Migration 0069 : rejouable", () => {
  it("appliquée une seconde fois, elle ne change rien (le rattrapage n'inscrit pas X, qui n'a ouvert qu'un aperçu depuis)", async () => {
    const avant = await inscriptions();
    await banc.appliquer(MIGRATION);
    expect(await inscriptions()).toEqual(avant);
    expect(await inscrit(X, payante)).toBe(false);
    expect(await acces(AB, payante.lecons[1])).toBe(true);
    expect(await acces(X, payante.lecons[1])).toBe(false);
    expect(await acces(X, payante.lecons[0])).toBe(true);
  });
});
