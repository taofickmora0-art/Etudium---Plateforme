import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0034 : finitions du lot 3 (défauts reportés des étapes A et B). Un quiz ou un exercice ne se « termine »
// pas comme une leçon ; la notification de publication dit ce qui paraît ; garde-fous sur les réponses et les fichiers.

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur de la formation
const E = randomUUID(); // étudiante qui suit la formation
let MODULE: string;
let LECON: string;
let QUIZ: string;
let EXO1: string;
let EXO2: string;
// Une formation payante dont un quiz et un exercice étaient cochés « aperçu » avant la 0034.
let QUIZ_APERCU: string;
let EXO_APERCU: string;
const V = randomUUID(); // compte connecté qui ne suit pas la formation payante

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const lecon = async (titre: string, type: string, publiee: boolean, ordre: number) =>
  (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, $2, $3, $4, $5) returning id", [MODULE, titre, type, publiee, ordre])).id;
const titres = async (qui: string) =>
  (await banc.db.query<{ titre: string }>("select titre from public.notifications where destinataire = $1 and categorie = 'nouveaux_contenus' order by cree_le, id", [qui])).rows.map((n) => n.titre);
const question = (choix: string, reponse = "") => [
  { genre: "unique", enonce: "Quel outil ?", choix: [{ texte: choix, correcte: true }, { texte: "Excel", correcte: false }], reponses: [], explication: "" },
  ...(reponse ? [{ genre: "courte", enonce: "Son nom ?", choix: [], reponses: [reponse], explication: "" }] : []),
];

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E, []], [V, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const formation = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Excel', $1, $2, true) returning id", [randomUUID(), fiche])).id;
  MODULE = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [formation])).id;
  LECON = await lecon("Découvrir l’interface", "lecon", true, 1);
  QUIZ = await lecon("Quiz du module 1", "quiz", false, 2);
  await banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [QUIZ, JSON.stringify(question("Zotero"))]);
  await banc.db.query("update public.lecons set publiee = true where id = $1", [QUIZ]);
  EXO1 = await lecon("Tableau des ventes", "exercice", true, 3);
  EXO2 = await lecon("Graphique des ventes", "exercice", true, 4);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [formation]);
  // L'étudiante suit la formation (règle provisoire : une leçon ouverte suffit).
  await banc.en({ id: E }, "select public.terminer_lecon($1)", [LECON]);

  // Avant la 0034 : un quiz et un exercice cochés « aperçu » dans une formation payante (la case existait).
  const payante = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Word', $1, $2, false) returning id", [randomUUID(), fiche])).id;
  const section = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [payante])).id;
  QUIZ_APERCU = (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, 'Quiz d’essai', 'quiz', false, 1) returning id", [section])).id;
  await banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [QUIZ_APERCU, JSON.stringify(question("Zotero"))]);
  await banc.db.query("update public.lecons set publiee = true, apercu = true where id = $1", [QUIZ_APERCU]);
  EXO_APERCU = (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, apercu, ordre) values ($1, 'Exercice d’essai', 'exercice', true, true, 2) returning id", [section])).id;
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [payante]);
  // Ouverts à tous, faute d'abonnement à vérifier : c'est ce que la 0034 corrige.
  expect((await banc.en<{ a: boolean }>({ id: V }, "select public.acces_lecon($1) as a", [QUIZ_APERCU]))[0].a).toBe(true);

  await banc.appliquer("supabase/migrations/0034_finitions_lot_3.sql");
});

describe("L'aperçu gratuit concerne les leçons seulement", () => {
  it("un ancien quiz ou exercice coché « aperçu » ne l'est plus après la 0034, et ne peut plus l'être", async () => {
    const lignes = await banc.db.query<{ apercu: boolean }>("select apercu from public.lecons where id = any($1)", [[QUIZ_APERCU, EXO_APERCU]]);
    expect(lignes.rows).toEqual([{ apercu: false }, { apercu: false }]);
    for (const l of [QUIZ_APERCU, EXO_APERCU]) {
      expect((await banc.en<{ a: boolean }>({ id: V }, "select public.acces_lecon($1) as a", [l]))[0].a, l).toBe(false);
    }
    await expect(banc.db.query("update public.lecons set apercu = true where id = $1", [QUIZ_APERCU])).rejects.toThrow(/lecons_apercu_lecons/);
    // Une leçon de contenu reste cochable.
    await banc.db.query("update public.lecons set apercu = true where id = $1", [LECON]);
    await banc.db.query("update public.lecons set apercu = false where id = $1", [LECON]);
  });
});

describe("Un quiz ou un exercice ne se « termine » pas comme une leçon", () => {
  it("terminer_lecon refuse un quiz et un exercice, accepte une leçon", async () => {
    await expect(banc.en({ id: E }, "select public.terminer_lecon($1)", [QUIZ])).rejects.toThrow("Un quiz se réussit, il ne se termine pas.");
    await expect(banc.en({ id: E }, "select public.terminer_lecon($1)", [EXO1])).rejects.toThrow("Un exercice se termine depuis sa page.");
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [LECON]);
    const lignes = await banc.db.query("select lecon_id from public.progression_lecons where profil_id = $1 and terminee_le is not null", [E]);
    expect(lignes.rows).toEqual([{ lecon_id: LECON }]);
  });
});

describe("La notification de publication dit ce qui paraît", () => {
  it("« Nouveau quiz », « Nouvel exercice », « Nouvelle leçon »", async () => {
    const avant = (await titres(E)).length;
    const q = await lecon("Quiz du module 2", "quiz", false, 5);
    await banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [q, JSON.stringify(question("Zotero"))]);
    await banc.db.query("update public.lecons set publiee = true where id = $1", [q]);
    await lecon("Mettre en forme", "exercice", true, 6);
    await lecon("Les filtres", "lecon", true, 7);
    expect((await titres(E)).slice(avant)).toEqual(["Nouveau quiz dans Excel", "Nouvel exercice dans Excel", "Nouvelle leçon dans Excel"]);
  });
});

describe("Garde-fous", () => {
  it("un choix ou une réponse acceptée de plus de 300 caractères est refusé", async () => {
    const long = "x".repeat(301);
    await expect(banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [QUIZ, JSON.stringify(question(long))])).rejects.toThrow();
    await expect(banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [QUIZ, JSON.stringify(question("Zotero", long))])).rejects.toThrow();
    // 300 caractères passent.
    await banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [QUIZ, JSON.stringify(question("x".repeat(300), "y".repeat(300)))]);
  });

  it("un même fichier ne s'attache pas à deux rendus, même par deux dépôts simultanés", async () => {
    const chemin = `${E}/${randomUUID()}/tableau.xlsx`;
    await banc.en({ id: E }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('rendus', $1, $2, $3::jsonb)", [
      chemin,
      E,
      JSON.stringify({ mimetype: XLSX, size: 142_000 }),
    ]);
    await banc.en({ id: E }, "select public.rendre_exercice($1, $2, 'tableau.xlsx', '')", [EXO1, chemin]);
    // rendre_exercice le vérifiait déjà (0032) ; deux appels au même instant passaient tous deux la vérification :
    // l'index unique de la 0034 refuse la seconde ligne.
    await expect(banc.en({ id: E }, "select public.rendre_exercice($1, $2, 'tableau.xlsx', '')", [EXO2, chemin])).rejects.toThrow();
    await expect(
      banc.db.query("insert into public.rendus_exercices (lecon_id, profil_id, version, fichier, nom_fichier) values ($1, $2, 1, $3, 'tableau.xlsx')", [EXO2, E, chemin]),
    ).rejects.toThrow(/rendus_exercices_fichier_unique/);
  });
});
