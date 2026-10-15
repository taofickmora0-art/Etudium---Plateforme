import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0033 : la validation d'une formation et le certificat (spec du lot 3, §4 à §7). La base calcule ce qui
// manque et délivre le certificat dès que tout est rempli, une seule fois, avec ses informations figées.

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiante qui valide tout
const E2 = randomUUID(); // étudiant : formation sans exercices obligatoires
const E3 = randomUUID(); // étudiant en cours
let FORMATION: string;
let L1: string;
let L2: string;
let QUIZ: string;
let EXO: string;
let BROUILLON: string;
let QUESTION: string;
let VIDE: string;

type Etat = {
  lecons: { terminees: number; total: number };
  minimum: number;
  exercices_obligatoires: boolean;
  quiz: { titre: string; meilleur: number | null; reussi: boolean }[];
  exercices: { titre: string; statut: string | null; valide: boolean }[];
  complet: boolean;
  certificat: { identifiant: string; titulaire: string; formation: string; formateur: string; parcours: string; delivre_le: string; vu: boolean } | null;
};

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const validation = async (qui: string, formation = FORMATION) => (await banc.en<{ v: Etat | null }>({ id: qui }, "select public.validation_formation($1) as v", [formation]))[0].v;
const terminer = (qui: string, lecon: string) =>
  banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, terminee_le) values ($1, $2, now()) on conflict (profil_id, lecon_id) do update set terminee_le = now()", [qui, lecon]);
const passerQuiz = (qui: string, juste: boolean) => banc.en({ id: qui }, "select public.envoyer_quiz($1, $2::jsonb)", [QUIZ, JSON.stringify({ [QUESTION]: [juste ? 0 : 1] })]);
const certificats = async (qui: string) => (await banc.db.query<{ identifiant: string }>("select identifiant from public.certificats where profil_id = $1", [qui])).rows;
const verifier = async (qui: "anon" | string, identifiant: string) =>
  (await banc.en<{ v: Record<string, string> | null }>(qui === "anon" ? "anon" : { id: qui }, "select public.verifier_certificat($1) as v", [identifiant]))[0].v;

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
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []], [E2, []], [E3, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Adjovi' where id = $1", [F]);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [E]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  await banc.db.query("update public.formateurs set nom = 'Dr Mireille Adjovi' where id = $1", [fiche]);
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Excel', $1, $2, true) returning id", [randomUUID(), fiche])).id;
  const parcours = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur) values ($1, 'Réussite académique', 'Académique', 'academique') returning id", [`p-${randomUUID().slice(0, 8)}`])).id;
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id) values ($1, $2)", [FORMATION, parcours]);
  const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [FORMATION])).id;
  const lecon = async (titre: string, type: string, publiee: boolean, ordre: number) =>
    (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, $2, $3, $4, $5) returning id", [m, titre, type, publiee, ordre])).id;
  L1 = await lecon("Découvrir l’interface", "lecon", true, 1);
  L2 = await lecon("Les formules", "lecon", true, 2);
  QUIZ = await lecon("Quiz du module 1", "quiz", false, 3);
  await banc.en({ id: F }, "select public.enregistrer_quiz($1, $2::jsonb)", [
    QUIZ,
    JSON.stringify([{ genre: "unique", enonce: "Quel outil ?", choix: [{ texte: "Zotero", correcte: true }, { texte: "Excel", correcte: false }], reponses: [], explication: "" }]),
  ]);
  await banc.db.query("update public.lecons set publiee = true where id = $1", [QUIZ]);
  QUESTION = (await un<{ id: string }>("select id from public.questions_quiz where lecon_id = $1", [QUIZ])).id;
  EXO = await lecon("Tableau des ventes", "exercice", true, 4);
  BROUILLON = await lecon("Leçon en préparation", "lecon", false, 5);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [FORMATION]);
  // Une formation sans leçon publiée : seulement un quiz.
  VIDE = (await un<{ id: string }>("insert into public.formations (titre, slug, gratuite) values ('Vide', $1, true) returning id", [randomUUID()])).id;
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [VIDE]);
});

describe("Migration 0033 : la validation et les certificats", () => {
  it("tant qu'une condition manque, rien n'est délivré ; l'état dit ce qui manque (éléments publiés seulement)", async () => {
    expect(await validation(E)).toMatchObject({
      lecons: { terminees: 0, total: 2 },
      minimum: 70,
      exercices_obligatoires: true,
      quiz: [{ titre: "Quiz du module 1", meilleur: null, reussi: false }],
      exercices: [{ titre: "Tableau des ventes", statut: null, valide: false }],
      complet: false,
      certificat: null,
    });
    await terminer(E, L1);
    await terminer(E, L2);
    await passerQuiz(E, false);
    expect(await validation(E)).toMatchObject({ lecons: { terminees: 2, total: 2 }, quiz: [{ meilleur: 0, reussi: false }], complet: false });
    await passerQuiz(E, true);
    expect(await validation(E)).toMatchObject({ quiz: [{ meilleur: 100, reussi: true }], complet: false, certificat: null });
    expect(await certificats(E)).toEqual([]);
  });

  it("le dernier exercice validé délivre le certificat : une seule fois, figé, notifié", async () => {
    const chemin = `${E}/${EXO}/v1.pdf`;
    await banc.en({ id: E }, "insert into storage.objects (bucket_id, name, metadata) values ('rendus', $1, $2::jsonb)", [chemin, JSON.stringify({ mimetype: "application/pdf", size: 1000 })]);
    const rendu = (await banc.en<{ r: { id: string } }>({ id: E }, "select public.rendre_exercice($1, $2, 'travail.pdf', '') as r", [EXO, chemin]))[0].r;
    expect(await certificats(E)).toEqual([]);
    await banc.en({ id: F }, "select public.corriger_rendu($1, 'valide', '')", [rendu.id]);
    const [certificat] = await certificats(E);
    expect(certificat.identifiant).toMatch(/^ET-\d{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect(await validation(E)).toMatchObject({
      complet: true,
      certificat: { identifiant: certificat.identifiant, titulaire: "Aïcha Kpadé", formation: "Excel", formateur: "Dr Mireille Adjovi", parcours: "Réussite académique", vu: false },
    });
    const notification = (await banc.db.query<{ titre: string; lien: string; categorie: string }>("select titre, lien, categorie from public.notifications where destinataire = $1 order by cree_le desc limit 1", [E])).rows[0];
    expect(notification).toMatchObject({ titre: "Votre certificat est prêt", categorie: "service" });
    // Une autre tentative, un titre qui change : toujours un seul certificat, avec le titre du jour de la délivrance.
    await passerQuiz(E, true);
    await banc.db.query("update public.formations set titre = 'Excel avancé' where id = $1", [FORMATION]);
    expect(await certificats(E)).toHaveLength(1);
    expect((await verifier("anon", certificat.identifiant))?.formation).toBe("Excel");
    await banc.db.query("update public.formations set titre = 'Excel' where id = $1", [FORMATION]);
  });

  it("« Exercices obligatoires » désactivé : l'exercice ne compte plus, et la page de validation délivre", async () => {
    await terminer(E2, L1);
    await terminer(E2, L2);
    await passerQuiz(E2, true);
    expect(await certificats(E2)).toEqual([]);
    await banc.db.query("update public.formations set exercices_obligatoires = false where id = $1", [FORMATION]);
    expect(await validation(E2)).toMatchObject({ exercices_obligatoires: false, complet: true, certificat: { formation: "Excel" } });
    await banc.db.query("update public.formations set exercices_obligatoires = true where id = $1", [FORMATION]);
  });

  it("une leçon publiée ensuite : l'état n'est plus complet, mais le certificat délivré reste ; une formation sans leçon ne délivre rien", async () => {
    await banc.db.query("update public.lecons set publiee = true where id = $1", [BROUILLON]);
    expect(await validation(E)).toMatchObject({ lecons: { terminees: 2, total: 3 }, complet: false, certificat: { formation: "Excel" } });
    await banc.db.query("update public.lecons set publiee = false where id = $1", [BROUILLON]);
    expect(await validation(E3, VIDE)).toMatchObject({ lecons: { total: 0 }, complet: false, certificat: null });
    expect(await validation(E3, randomUUID())).toBeNull();
  });

  it("la vérification, sans compte : ce que montre le certificat ; un identifiant inconnu, rien ; minuscules et espaces tolérés", async () => {
    const [{ identifiant }] = await certificats(E);
    expect(await verifier("anon", identifiant)).toEqual({
      identifiant,
      titulaire: "Aïcha Kpadé",
      formation: "Excel",
      formateur: "Dr Mireille Adjovi",
      parcours: "Réussite académique",
      delivre_le: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    });
    expect(await verifier("anon", `  ${identifiant.toLowerCase()} `)).toMatchObject({ identifiant });
    expect(await verifier("anon", "ET-2026-AAAA-AAAA")).toBeNull();
    await expect(banc.en("anon", "select * from public.certificats")).rejects.toThrow(/permission denied|row-level security/);
  });

  it("le fichier du certificat : pour son titulaire seulement ; « vu » une fois la fenêtre montrée", async () => {
    const [{ identifiant }] = await certificats(E);
    const mien = async (qui: string) => (await banc.en<{ c: Record<string, string> | null }>({ id: qui }, "select public.mon_certificat($1) as c", [identifiant]))[0].c;
    expect(await mien(E)).toMatchObject({ identifiant, titulaire: "Aïcha Kpadé" });
    expect(await mien(E2)).toBeNull();
    await expect(banc.en("anon", "select public.mon_certificat($1)", [identifiant])).rejects.toThrow(/permission denied/);
    await banc.en({ id: E2 }, "select public.marquer_certificat_vu($1)", [identifiant]);
    expect((await validation(E))?.certificat?.vu).toBe(false);
    await banc.en({ id: E }, "select public.marquer_certificat_vu($1)", [identifiant]);
    expect((await validation(E))?.certificat?.vu).toBe(true);
  });

  it("la page Certificats : obtenus et en préparation (avec ce qui manque)", async () => {
    await terminer(E3, L1);
    const page = async (qui: string) =>
      (await banc.en<{ p: { obtenus: { formation: string }[]; en_preparation: { titre: string; terminees: number; total: number; quiz_restants: number; exercices_restants: number }[] } }>({ id: qui }, "select public.mes_certificats() as p"))[0].p;
    expect(await page(E)).toMatchObject({ obtenus: [{ formation: "Excel" }], en_preparation: [] });
    expect(await page(E3)).toEqual({ obtenus: [], en_preparation: [expect.objectContaining({ titre: "Excel", terminees: 1, total: 2, quiz_restants: 1, exercices_restants: 1 })] });
  });

  it("le formateur : ses certificats délivrés, et la fiche d'un étudiant (scores, exercices, certificat)", async () => {
    const nombre = async (qui: string) => (await banc.en<{ n: number }>({ id: qui }, "select public.certificats_formateur() as n"))[0].n;
    expect(await nombre(F)).toBe(2);
    expect(await nombre(G)).toBe(0);
    expect(await nombre(S)).toBe(2);
    const fiche = async (qui: string) => (await banc.en<{ f: unknown[] }>({ id: qui }, "select public.lot3_etudiant($1) as f", [E]))[0].f;
    expect(await fiche(F)).toEqual([
      expect.objectContaining({
        formation_id: FORMATION,
        quiz: [expect.objectContaining({ titre: "Quiz du module 1", meilleur: 100, reussi: true })],
        exercices: [expect.objectContaining({ titre: "Tableau des ventes", statut: "valide" })],
        certificat: expect.stringMatching(/^ET-/),
      }),
    ]);
    expect(await fiche(G)).toEqual([]);
  });

  it("le compte supprimé : le certificat reste vérifiable, au nom figé", async () => {
    const [{ identifiant }] = await certificats(E);
    await banc.en({ id: E }, "select public.supprimer_mon_compte()");
    expect(await verifier("anon", identifiant)).toMatchObject({ titulaire: "Aïcha Kpadé", formation: "Excel" });
  });
});
