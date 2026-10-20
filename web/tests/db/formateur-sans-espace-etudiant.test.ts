import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0036 (restructuration, R1) : un formateur n'est plus étudiant. Il n'ouvre que ses formations, la base
// refuse toute action d'étudiant de sa part, et les notifications d'apprentissage ne lui sont plus envoyées.

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur de la formation A (payante)
const G = randomUUID(); // formateur de la formation B (gratuite, une leçon en aperçu)
const E = randomUUID(); // étudiante
const X = randomUUID(); // étudiant qui deviendra formateur
let leconA: string;
let leconB: string;
let formationB: string;

const REFUS = "Un compte formateur ne suit pas de formation.";
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const acces = async (qui: string, lecon: string) => (await banc.en<{ a: boolean }>({ id: qui }, "select public.acces_lecon($1) as a", [lecon]))[0].a;
const terminer = (qui: string, lecon: string) => banc.en({ id: qui }, "select public.terminer_lecon($1)", [lecon]);

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie", "0036_formateur_sans_espace_etudiant",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []], [X, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const f of [F, G]) await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [f]);
  const fiche = async (compte: string) => (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [compte])).id;
  const formation = async (titre: string, compte: string, gratuite: boolean, apercu: boolean) => {
    const f = (await un<{ id: string }>(
      "insert into public.formations (titre, slug, formateur_id, gratuite, statut) values ($1, $2, $3, $4, 'publiee') returning id",
      [titre, `${titre.toLowerCase()}-${randomUUID().slice(0, 6)}`, await fiche(compte), gratuite],
    )).id;
    const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [f])).id;
    const l = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, ordre, apercu) values ($1, 'Leçon 1', true, 1, $2) returning id", [m, apercu])).id;
    return { f, l };
  };
  ({ l: leconA } = await formation("Excel", F, false, false));
  ({ f: formationB, l: leconB } = await formation("Canva", G, true, true));
});

describe("Accès aux formations", () => {
  it("un formateur n'ouvre que ses formations", async () => {
    expect(await acces(F, leconB)).toBe(false); // gratuite et en aperçu, mais pas la sienne
    expect(await acces(E, leconB)).toBe(true);
    expect(await acces(F, leconA)).toBe(true);
  });
});

describe("Actions d'étudiant", () => {
  it("aucune action d'étudiant pour un formateur, ni par la base", async () => {
    await expect(terminer(F, leconA)).rejects.toThrow(REFUS);
    await expect(banc.db.query("insert into public.favoris (profil_id, formation_id) values ($1, $2)", [F, formationB])).rejects.toThrow(REFUS);
    const session = (await un<{ id: string }>(
      "insert into public.sessions_live (titre, debut, lien) values ('Live', now() + interval '1 day', 'https://meet.google.com/abc') returning id",
    )).id;
    await expect(banc.db.query("insert into public.inscriptions_sessions (session_id, profil_id) values ($1, $2)", [session, F])).rejects.toThrow(REFUS);
    await expect(banc.db.query("insert into public.conversations (etudiant_id, formateur_id) values ($1, $2)", [F, G])).rejects.toThrow(REFUS);
    // Les autres tables d'étudiant portent le même déclencheur.
    for (const table of ["progression_lecons", "favoris", "avis", "inscriptions_sessions", "tentatives_quiz", "rendus_exercices"]) {
      const { n } = await un<{ n: number }>(
        "select count(*)::int as n from pg_trigger where tgrelid = $1::regclass and tgfoid = 'public.refuser_compte_formateur'::regproc",
        [`public.${table}`],
      );
      expect(n, table).toBe(1);
    }
  });

  it("l'étudiante garde toutes ses actions", async () => {
    await terminer(E, leconB);
    await banc.db.query("insert into public.favoris (profil_id, formation_id) values ($1, $2)", [E, formationB]);
    const { n } = await un<{ n: number }>("select count(*)::int as n from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, leconB]);
    expect(n).toBe(1);
  });

  it("devenu formateur, le passé ne se rouvre pas ; redevenu étudiant, si", async () => {
    await terminer(X, leconB);
    await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [X]);
    // La leçon d'un autre ne lui est plus ouverte : refusée avant même le déclencheur.
    await expect(terminer(X, leconB)).rejects.toThrow("Leçon inaccessible.");
    expect(await acces(X, leconB)).toBe(false);
    // Côté étudiant de la messagerie : sa conversation d'avant ne reprend pas.
    const conv = (await un<{ id: string }>("insert into public.conversations (etudiant_id) values ($1) returning id", [E])).id;
    await expect(
      banc.db.query("insert into public.messages (conversation_id, auteur_id, de_etudiant, texte) values ($1, $2, true, 'Bonjour')", [conv, X]),
    ).rejects.toThrow(REFUS);
    await banc.en({ id: S }, "select public.changer_role($1, 'etudiant')", [X]);
    expect(await acces(X, leconB)).toBe(true);
    await terminer(X, leconB);
  });
});

describe("Notifications", () => {
  it("les notifications d'apprentissage ne vont plus au formateur", async () => {
    const recues = async (qui: string, categorie: string) =>
      (await un<{ n: number }>("select count(*)::int as n from public.notifications where destinataire = $1 and categorie = $2", [qui, categorie])).n;
    const avantF = await recues(F, "sessions_live");
    const avantE = await recues(E, "sessions_live");
    await banc.db.query("select public.notifier($1::uuid[], 'sessions_live', 'Nouvelle session', '', '/evenements')", [[F, E]]);
    expect(await recues(F, "sessions_live")).toBe(avantF);
    expect(await recues(E, "sessions_live")).toBe(avantE + 1);
    const messagesF = await recues(F, "messages");
    await banc.db.query("select public.notifier($1::uuid[], 'messages', 'Nouveau message', '', '/formateur/messages')", [[F]]);
    expect(await recues(F, "messages")).toBe(messagesF + 1);
  });
});
