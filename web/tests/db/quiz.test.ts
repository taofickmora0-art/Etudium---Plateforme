import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0031 : les quiz (spec du lot 3, §2). Le formateur crée les questions ; l'étudiant les passe ; la base
// corrige, garde le meilleur score, applique le score minimal de la formation, et ne livre les bonnes réponses qu'après.

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiant
let FORMATION: string;
let LECON: string;
let QUIZ: string;
let BROUILLON: string;

type Question = { id?: string; genre: string; enonce: string; choix: { texte: string; correcte: boolean }[]; reponses: string[]; explication: string };
const QUESTIONS: Question[] = [
  { genre: "unique", enonce: "Quel outil gère les références ?", choix: [{ texte: "Zotero", correcte: true }, { texte: "Excel", correcte: false }], reponses: [], explication: "" },
  {
    genre: "multiple",
    enonce: "Que place-t-on dans un tableau croisé dynamique ?",
    choix: [
      { texte: "Des lignes", correcte: true },
      { texte: "Des colonnes", correcte: true },
      { texte: "Une vidéo", correcte: false },
    ],
    reponses: [],
    explication: "",
  },
  { genre: "vrai_faux", enonce: "Un TCD modifie les données d'origine.", choix: [{ texte: "Vrai", correcte: false }, { texte: "Faux", correcte: true }], reponses: [], explication: "Le TCD résume sans modifier." },
  { genre: "courte", enonce: "Quelle fonction cherche une valeur ?", choix: [], reponses: ["RECHERCHEX"], explication: "" },
];

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const enregistrer = (qui: string, lecon: string, questions: unknown) => banc.en({ id: qui }, "select public.enregistrer_quiz($1, $2::jsonb)", [lecon, JSON.stringify(questions)]);
const editeur = async (qui: string, lecon: string) => (await banc.en<{ q: { questions: (Question & { id: string })[] } }>({ id: qui }, "select public.quiz_editeur($1) as q", [lecon]))[0].q;
const aPasser = async (qui: string, lecon: string) =>
  (await banc.en<{ q: { questions: Record<string, unknown>[]; meilleur: number | null; tentatives: number; score_minimal: number } | null }>({ id: qui }, "select public.quiz_a_passer($1) as q", [lecon]))[0].q;
type Resultat = { score: number; bonnes: number; total: number; reussi: boolean; meilleur: number; numero: number; score_minimal: number; detail: { correcte: boolean; votre_reponse: string; bonne_reponse: string; explication: string }[] };
const envoyer = async (qui: string, lecon: string, reponses: Record<string, unknown>) =>
  (await banc.en<{ r: Resultat }>({ id: qui }, "select public.envoyer_quiz($1, $2::jsonb) as r", [lecon, JSON.stringify(reponses)]))[0].r;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Excel', $1, $2, true) returning id", [randomUUID(), fiche])).id;
  const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [FORMATION])).id;
  const lecon = async (titre: string, type: string, publiee: boolean, ordre: number) =>
    (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, $2, $3, $4, $5) returning id", [m, titre, type, publiee, ordre])).id;
  LECON = await lecon("Saisir des données", "lecon", true, 1);
  QUIZ = await lecon("Quiz du module 1", "quiz", true, 2);
  BROUILLON = await lecon("Quiz en préparation", "quiz", false, 3);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [FORMATION]);
});

describe("Migration 0031 : les quiz", () => {
  it("le formateur de la formation enregistre les questions ; un autre formateur ou un étudiant, non ; une leçon ordinaire n'est pas un quiz", async () => {
    await enregistrer(F, QUIZ, QUESTIONS);
    const lu = await editeur(F, QUIZ);
    expect(lu.questions.map((q) => q.genre)).toEqual(["unique", "multiple", "vrai_faux", "courte"]);
    expect(lu.questions[2]).toMatchObject({ choix: [{ texte: "Vrai", correcte: false }, { texte: "Faux", correcte: true }], explication: "Le TCD résume sans modifier." });
    await expect(enregistrer(G, QUIZ, QUESTIONS)).rejects.toThrow(/pas l’une de vos formations/);
    await expect(enregistrer(E, QUIZ, QUESTIONS)).rejects.toThrow(/pas l’une de vos formations/);
    await expect(editeur(E, QUIZ)).rejects.toThrow(/pas l’une de vos formations/);
    await expect(enregistrer(F, LECON, QUESTIONS)).rejects.toThrow("Cette leçon n’est pas un quiz.");
  });

  it("une question mal formée, ou un quiz vide, est refusé avec un message clair", async () => {
    const q = (o: Partial<Question>) => [{ ...QUESTIONS[0], ...o }];
    await expect(enregistrer(F, QUIZ, [])).rejects.toThrow("Ajoutez au moins une question.");
    await expect(enregistrer(F, QUIZ, q({ enonce: "  " }))).rejects.toThrow("La question 1 n’a pas d’énoncé.");
    await expect(enregistrer(F, QUIZ, q({ choix: [{ texte: "Zotero", correcte: false }, { texte: "Excel", correcte: false }] }))).rejects.toThrow("La question 1 doit avoir une seule bonne réponse.");
    await expect(enregistrer(F, QUIZ, q({ choix: [{ texte: "Zotero", correcte: true }] }))).rejects.toThrow("La question 1 doit proposer de 2 à 6 réponses.");
    await expect(enregistrer(F, QUIZ, q({ genre: "multiple", choix: [{ texte: "A", correcte: false }, { texte: "B", correcte: false }] }))).rejects.toThrow("La question 1 doit avoir au moins une bonne réponse.");
    await expect(enregistrer(F, QUIZ, q({ genre: "courte", choix: [], reponses: [" "] }))).rejects.toThrow("La question 1 doit avoir au moins une réponse acceptée.");
    await expect(enregistrer(F, QUIZ, q({ genre: "vrai_faux", choix: [{ texte: "Oui", correcte: true }, { texte: "Non", correcte: false }] }))).rejects.toThrow("La question 1 : vrai ou faux attend les réponses « Vrai » et « Faux ».");
    // Rien n'a été remplacé : les quatre questions sont toujours là.
    expect((await editeur(F, QUIZ)).questions).toHaveLength(4);
  });

  it("l'étudiant lit les questions sans les bonnes réponses ni les explications", async () => {
    const q = (await aPasser(E, QUIZ))!;
    expect(q).toMatchObject({ meilleur: null, tentatives: 0, score_minimal: 70 });
    expect(q.questions).toHaveLength(4);
    const texte = JSON.stringify(q.questions);
    expect(texte).not.toContain("correcte");
    expect(texte).not.toContain("RECHERCHEX");
    expect(texte).not.toContain("Le TCD résume");
    expect(q.questions[0]).toMatchObject({ genre: "unique", choix: ["Zotero", "Excel"] });
  });

  it("la base corrige : réponses multiples exactes, réponse courte sans majuscules ni accents ; détail et bonnes réponses après l'envoi ; meilleur score gardé", async () => {
    const ids = (await editeur(F, QUIZ)).questions.map((q) => q.id);
    const r1 = await envoyer(E, QUIZ, { [ids[0]]: [0], [ids[1]]: [0, 1], [ids[2]]: [0], [ids[3]]: "  recherchéx " });
    expect(r1).toMatchObject({ score: 75, bonnes: 3, total: 4, reussi: true, meilleur: 75, numero: 1, score_minimal: 70 });
    expect(r1.detail[2]).toMatchObject({ correcte: false, votre_reponse: "Vrai", bonne_reponse: "Faux", explication: "Le TCD résume sans modifier." });
    expect(r1.detail[3]).toMatchObject({ correcte: true, votre_reponse: "  recherchéx " });
    // Une réponse multiple incomplète est fausse ; une question passée aussi ; « RechercheV » aussi.
    const r2 = await envoyer(E, QUIZ, { [ids[0]]: [0], [ids[1]]: [0], [ids[3]]: "RechercheV" });
    expect(r2).toMatchObject({ score: 25, bonnes: 1, reussi: false, meilleur: 75, numero: 2 });
    expect(r2.detail[1].votre_reponse).toBe("Des lignes");
    expect(r2.detail[2]).toMatchObject({ correcte: false, votre_reponse: "" });
    expect((await aPasser(E, QUIZ))!).toMatchObject({ meilleur: 75, tentatives: 2 });
    expect((await banc.en<{ s: Record<string, number> }>({ id: E }, "select public.mes_scores_quiz($1) as s", [FORMATION]))[0].s).toEqual({ [QUIZ]: 75 });
  });

  it("le score minimal est celui de la formation", async () => {
    await banc.db.query("update public.formations set score_quiz = 80 where id = $1", [FORMATION]);
    const ids = (await editeur(F, QUIZ)).questions.map((q) => q.id);
    expect(await envoyer(E, QUIZ, { [ids[0]]: [0], [ids[1]]: [0, 1], [ids[2]]: [1] })).toMatchObject({ score: 75, reussi: false, score_minimal: 80 });
    await banc.db.query("update public.formations set score_quiz = 70 where id = $1", [FORMATION]);
  });

  it("sans accès (quiz en brouillon, visiteur), ni lecture ni envoi", async () => {
    await enregistrer(F, BROUILLON, QUESTIONS);
    expect(await aPasser(E, BROUILLON)).toBeNull();
    await expect(envoyer(E, BROUILLON, {})).rejects.toThrow("Ce quiz ne vous est pas ouvert.");
    await expect(banc.en("anon", "select public.envoyer_quiz($1, '{}'::jsonb)", [QUIZ])).rejects.toThrow(/permission denied/);
    await expect(banc.en({ id: E }, "select * from public.questions_quiz")).rejects.toThrow(/permission denied|row-level security/);
  });

  it("les quiz ne comptent pas dans la progression : l'avis s'ouvre à 50 % des leçons de contenu ; le suivi compte une leçon", async () => {
    await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, vue_le, ouverte_le, terminee_le) values ($1, $2, now(), now(), now())", [E, LECON]);
    expect((await banc.en<{ ok: boolean }>({ id: E }, "select public.peut_donner_avis($1) as ok", [FORMATION]))[0].ok).toBe(true);
    const page = (await banc.en<{ r: { lignes: { terminees: number; total: number }[] } }>({ id: F }, "select public.apprenants_formation($1) as r", [FORMATION]))[0].r;
    expect(page.lignes[0]).toMatchObject({ terminees: 1, total: 1 });
  });
});
