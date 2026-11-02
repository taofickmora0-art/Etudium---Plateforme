import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, creerParcours } from "./engagement-banc";

// Migration 0070 : le formateur public (spec du 2 novembre 2026, §3, §5, §6 et §9). Les réseaux d'une fiche (six
// réseaux, adresses en https://), sa fiche publique lisible par tous (formations publiées, photo du compte relié) et
// « peut_ecrire » : le compte connecté est inscrit à une de ses formations, et la fiche est reliée à un compte formateur.
// ouvrir_conversation_formateur ouvre la conversation sans que l'appli connaisse le compte relié.

const MIGRATION = "supabase/migrations/0070_formateurs_public.sql";

let banc: Banc;
const [S, A, F, G, E, N, P, SU] = Array.from({ length: 8 }, () => randomUUID());
// S : super admin ; A : admin (équipe des contenus) ; F, G : formateurs ; E : étudiante inscrite à « Excel » (de F), à
// « Statistiques » (fiche sans compte) et à « Couture » (fiche reliée à P, qui n'est pas formateur) ; N : étudiant
// inscrit nulle part ; P : compte étudiant relié à une fiche ; SU : inscrite à « Excel », puis suspendue.
let FF: string; // fiche de F
let FG: string; // fiche de G
let SANS: string; // fiche sans compte
let FP: string; // fiche reliée à P
const PHOTO_F = `${F}/${randomUUID()}.jpg`;
const IMAGE = randomUUID();
const couvertureExcel = (formation: string) => `${formation}/${IMAGE}.webp`;

type FormationPublique = {
  id: string;
  slug: string;
  titre: string;
  resume: string;
  couverture: string | null;
  niveau: string;
  gratuite: boolean;
  badge: string | null;
  publiee_le: string;
  duree_secondes: number;
  nb_lecons: number;
  nb_modules: number;
  note_moyenne: number | null;
  nb_avis: number;
  parcours: { slug: string; nom: string; nom_court: string; couleur: string; ordre: number; position: number }[];
};
type FormateurPublic = {
  id: string;
  nom: string;
  titre: string;
  domaine: string;
  presentation: string;
  reseaux: Record<string, string>;
  photo: string | null;
  rejoint_le: string;
  formations: FormationPublique[];
  nb_formations: number;
  peut_ecrire: boolean;
};

const lire = async (qui: string | "anon", fiche: string) =>
  (await banc.en<{ r: FormateurPublic | null }>(qui === "anon" ? "anon" : { id: qui }, "select public.formateur_public($1) as r", [fiche]))[0].r;
const ecrire = async (qui: string | "anon", fiche: string) =>
  (await banc.en<{ r: string }>(qui === "anon" ? "anon" : { id: qui }, "select public.ouvrir_conversation_formateur($1) as r", [fiche]))[0].r;
const reseaux = (fiche: string, valeur: unknown) =>
  banc.db.query("update public.formateurs set reseaux = $2::jsonb where id = $1", [fiche, JSON.stringify(valeur)]);
const ficheDe = async (compte: string) => (await banc.db.query<{ id: string }>("select id from public.formateurs where compte_id = $1", [compte])).rows[0].id;
const nouvelleFiche = async (nom: string) => (await banc.db.query<{ id: string }>("insert into public.formateurs (nom) values ($1) returning id", [nom])).rows[0].id;
const inscrire = (qui: string, formation: string) => banc.en({ id: qui }, "select public.s_inscrire_formation($1)", [formation]);

let excel: string;
let word: string;

beforeAll(async () => {
  banc = await creerBanc([...migrationsJusqua("0069"), MIGRATION]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [G, []], [E, []], [N, []], [P, []], [SU, []]] as const) {
    await banc.creerCompte(id, [...roles]);
  }
  for (const id of [F, G]) await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [id]);
  [FF, FG] = [await ficheDe(F), await ficheDe(G)];
  await banc.db.query("update public.formateurs set nom = 'Koffi Mensah', titre = 'Expert Excel', domaine = 'Bureautique', presentation = 'Dix ans de formation.' where id = $1", [FF]);
  await banc.db.query("update public.profils set photo_url = $2 where id = $1", [F, PHOTO_F]);
  SANS = await nouvelleFiche("Dr Mireille Adjovi");
  FP = await nouvelleFiche("Fiche reliée à un étudiant");
  await banc.db.query("update public.formateurs set compte_id = $2 where id = $1", [FP, P]);

  // Deux parcours : « Compétences » passe avant « Académique » (ordre 1 contre 2).
  const academique = await creerParcours(banc, "Académique", "academique");
  const digital = await creerParcours(banc, "Compétences", "digital");
  await banc.db.query("update public.parcours set ordre = 2 where id = $1", [academique]);
  await banc.db.query("update public.parcours set ordre = 1 where id = $1", [digital]);

  // Excel : 3 leçons, un quiz et un exercice (hors des leçons), un second module avec une leçon en brouillon (hors aussi).
  const e = await creerFormation(banc, "Excel", { formateur: FF, lecons: 3, parcours: [academique, digital], publieeLe: "'2026-10-01 09:00+00'" });
  excel = e.id;
  await banc.db.query("update public.formations_parcours set ordre = 4 where formation_id = $1 and parcours_id = $2", [excel, digital]);
  await banc.db.query("update public.formations set resume = 'Les tableaux croisés.', couverture = $2, badge = 'populaire' where id = $1", [excel, couvertureExcel(excel)]);
  const m2 = (await banc.db.query<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 2', 2) returning id", [excel])).rows[0].id;
  await banc.db.query("insert into public.lecons (module_id, titre, type, publiee, ordre, duree_secondes) values ($1, 'Brouillon', 'lecon', false, 1, 900)", [m2]);
  word = (await creerFormation(banc, "Word", { formateur: FF, quiz: false, exercice: null, gratuite: false, publieeLe: "'2026-10-20 09:00+00'" })).id;
  await creerFormation(banc, "PowerPoint (brouillon)", { formateur: FF, statut: "brouillon" });
  await creerFormation(banc, "Access (archivée)", { formateur: FF, statut: "archivee" });
  await creerFormation(banc, "Canva", { formateur: FG });
  const stats = (await creerFormation(banc, "Statistiques", { formateur: SANS, quiz: false, exercice: null })).id;
  const couture = (await creerFormation(banc, "Couture", { formateur: FP, quiz: false, exercice: null })).id;

  for (const formation of [excel, stats, couture]) await inscrire(E, formation);
  await inscrire(SU, excel);
  await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [SU, S]);
}, 60_000);

describe("Migration 0070 : les réseaux d'une fiche", () => {
  it("une fiche n'a aucun réseau par défaut ; six réseaux en https:// sont acceptés", async () => {
    expect((await lire("anon", FG))?.reseaux).toEqual({});
    const tous = {
      instagram: "https://instagram.com/koffi",
      youtube: "https://youtube.com/@koffi",
      linkedin: "https://linkedin.com/in/koffi",
      facebook: "https://facebook.com/koffi",
      telegram: "https://t.me/koffi",
      tiktok: "https://tiktok.com/@koffi",
    };
    await reseaux(FF, tous);
    expect((await lire("anon", FF))?.reseaux).toEqual(tous);
  });

  it("refusés : une clé inconnue, une adresse en http://, une adresse trop longue, une valeur qui n'est pas un texte", async () => {
    await expect(reseaux(FG, { twitter: "https://x.com/koffi" })).rejects.toThrow(/formateurs_reseaux/);
    await expect(reseaux(FG, { instagram: "http://instagram.com/koffi" })).rejects.toThrow(/formateurs_reseaux/);
    await expect(reseaux(FG, { instagram: `https://instagram.com/${"a".repeat(280)}` })).rejects.toThrow(/formateurs_reseaux/);
    await expect(reseaux(FG, { instagram: "https://instagram.com/avec espace" })).rejects.toThrow(/formateurs_reseaux/);
    await expect(reseaux(FG, { instagram: 3 })).rejects.toThrow(/formateurs_reseaux/);
    await expect(reseaux(FG, ["https://instagram.com/koffi"])).rejects.toThrow(/formateurs_reseaux/);
    await expect(banc.db.query("update public.formateurs set reseaux = null where id = $1", [FG])).rejects.toThrow();
    // 300 caractères tout juste : accepté.
    const limite = `https://instagram.com/${"a".repeat(300 - "https://instagram.com/".length)}`;
    await reseaux(FG, { instagram: limite });
    expect((await lire("anon", FG))?.reseaux).toEqual({ instagram: limite });
    await reseaux(FG, {});
  });

  it("l'équipe des contenus les écrit par l'API (droit de colonne) ; un étudiant, non", async () => {
    await banc.en({ id: A }, "update public.formateurs set reseaux = $2::jsonb where id = $1", [SANS, JSON.stringify({ linkedin: "https://linkedin.com/in/mireille" })]);
    expect((await lire("anon", SANS))?.reseaux).toEqual({ linkedin: "https://linkedin.com/in/mireille" });
    await expect(
      banc.en({ id: A }, "update public.formateurs set reseaux = $2::jsonb where id = $1", [SANS, JSON.stringify({ linkedin: "http://linkedin.com/in/mireille" })]),
    ).rejects.toThrow(/formateurs_reseaux/);
    await banc.en({ id: E }, "update public.formateurs set reseaux = '{}'::jsonb where id = $1", [SANS]);
    expect((await lire("anon", SANS))?.reseaux).toEqual({ linkedin: "https://linkedin.com/in/mireille" });
  });
});

describe("Migration 0070 : la fiche publique d'un formateur", () => {
  it("une fiche inexistante donne null", async () => {
    expect(await lire("anon", randomUUID())).toBeNull();
    expect(await lire(E, randomUUID())).toBeNull();
  });

  it("un visiteur lit la fiche : ses informations, sa photo, ses formations publiées seulement ; il ne peut pas écrire", async () => {
    const fiche = await lire("anon", FF);
    expect(Object.keys(fiche ?? {}).sort()).toEqual(
      ["domaine", "formations", "id", "nb_formations", "nom", "peut_ecrire", "photo", "presentation", "reseaux", "rejoint_le", "titre"].sort(),
    );
    expect(fiche).toMatchObject({
      id: FF,
      nom: "Koffi Mensah",
      titre: "Expert Excel",
      domaine: "Bureautique",
      presentation: "Dix ans de formation.",
      photo: PHOTO_F,
      nb_formations: 2,
      peut_ecrire: false,
    });
    const creeLe = (await banc.db.query<{ cree_le: Date }>("select cree_le from public.formateurs where id = $1", [FF])).rows[0].cree_le;
    expect(new Date(fiche!.rejoint_le).toISOString()).toBe(creeLe.toISOString());
    // Brouillon et archivée exclues ; la plus récemment publiée d'abord.
    expect(fiche!.formations.map((f) => f.titre)).toEqual(["Word", "Excel"]);
  });

  it("chaque formation : de quoi afficher la carte du catalogue (leçons et modules comptés, premier parcours d'abord)", async () => {
    const fiche = await lire("anon", FF);
    const carte = fiche!.formations.find((f) => f.id === excel)!;
    expect(Object.keys(carte).sort()).toEqual(
      ["badge", "couverture", "duree_secondes", "gratuite", "id", "nb_avis", "nb_lecons", "nb_modules", "niveau", "note_moyenne", "parcours", "publiee_le", "resume", "slug", "titre"].sort(),
    );
    // 3 leçons publiées de 10 min ; le quiz, l'exercice et la leçon en brouillon ne comptent pas.
    expect(carte).toMatchObject({
      titre: "Excel",
      resume: "Les tableaux croisés.",
      couverture: couvertureExcel(excel),
      niveau: "debutant",
      gratuite: true,
      badge: "populaire",
      duree_secondes: 1800,
      nb_lecons: 3,
      nb_modules: 2,
      note_moyenne: null,
      nb_avis: 0,
    });
    expect(carte.slug).toMatch(/^f-/);
    expect(carte.parcours.map((p) => [p.nom_court, p.couleur, p.ordre, p.position])).toEqual([
      ["Compétences", "digital", 1, 4],
      ["Académique", "academique", 2, 0],
    ]);
    const autre = fiche!.formations.find((f) => f.id === word)!;
    expect(autre).toMatchObject({ gratuite: false, badge: null, couverture: null, nb_lecons: 2, nb_modules: 1, parcours: [] });
  });

  it("un formateur sans formation publiée : liste vide, 0 formation, pas de photo", async () => {
    const fiche = await lire("anon", SANS);
    expect(fiche).toMatchObject({ nom: "Dr Mireille Adjovi", photo: null, nb_formations: 1 });
    const vide = await nouvelleFiche("Nouvelle fiche");
    expect(await lire("anon", vide)).toMatchObject({ formations: [], nb_formations: 0, photo: null, reseaux: {}, peut_ecrire: false });
  });

  it("peut_ecrire : vrai pour l'étudiante inscrite à une de ses formations", async () => {
    expect((await lire(E, FF))?.peut_ecrire).toBe(true);
  });

  it("peut_ecrire : faux pour un étudiant non inscrit, une fiche sans compte, un compte qui n'est pas formateur", async () => {
    expect((await lire(N, FF))?.peut_ecrire).toBe(false);
    // E n'est inscrite à aucune formation de G.
    expect((await lire(E, FG))?.peut_ecrire).toBe(false);
    // Inscrite à « Statistiques », mais la fiche n'est reliée à aucun compte.
    expect((await lire(E, SANS))?.peut_ecrire).toBe(false);
    // Inscrite à « Couture », mais le compte relié n'a pas le rôle formateur.
    expect((await lire(E, FP))?.peut_ecrire).toBe(false);
  });

  it("peut_ecrire : faux pour le formateur lui-même et pour un compte suspendu", async () => {
    expect((await lire(F, FF))?.peut_ecrire).toBe(false);
    expect((await lire(SU, FF))?.peut_ecrire).toBe(false);
    expect(await lire(SU, FF)).toMatchObject({ nom: "Koffi Mensah", nb_formations: 2 });
  });

  it("la photo : le chemin de la photo du compte relié (espace public « photos-profil »), null sans photo ou sans compte", async () => {
    expect((await lire("anon", FF))?.photo).toBe(PHOTO_F);
    expect((await lire("anon", FG))?.photo).toBeNull();
    expect((await lire("anon", SANS))?.photo).toBeNull();
    // Aucun accès nouveau aux profils : ni le visiteur ni l'étudiante ne lisent celui du formateur.
    expect(await banc.en("anon", "select photo_url from public.profils")).toEqual([]);
    expect(await banc.en({ id: E }, "select photo_url from public.profils where id = $1", [F])).toEqual([]);
  });
});

describe("Migration 0070 : écrire au formateur", () => {
  it("l'étudiante inscrite ouvre la conversation avec le compte relié ; la même à chaque fois", async () => {
    const id = await ecrire(E, FF);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await ecrire(E, FF)).toBe(id);
    const conversation = (await banc.db.query<{ etudiant_id: string; formateur_id: string }>("select etudiant_id, formateur_id from public.conversations where id = $1", [id])).rows[0];
    expect(conversation).toEqual({ etudiant_id: E, formateur_id: F });
    expect((await banc.en<{ r: string }>({ id: E }, "select public.ouvrir_conversation($1) as r", [F]))[0].r).toBe(id);
  });

  it("refusé avec un message en français : non inscrit, fiche sans compte, compte non formateur, fiche inconnue, suspendu, soi-même", async () => {
    await expect(ecrire(N, FF)).rejects.toThrow(/Inscrivez-vous/);
    await expect(ecrire(E, FG)).rejects.toThrow(/Inscrivez-vous/);
    await expect(ecrire(E, SANS)).rejects.toThrow(/ne reçoit pas de messages/);
    await expect(ecrire(E, FP)).rejects.toThrow(/ne reçoit pas de messages/);
    await expect(ecrire(E, randomUUID())).rejects.toThrow(/introuvable/);
    await expect(ecrire(SU, FF)).rejects.toThrow(/suspendu/);
    await expect(ecrire(F, FF)).rejects.toThrow(/vous-même/);
    const conversations = (await banc.db.query<{ n: number }>("select count(*)::integer as n from public.conversations where formateur_id is not null")).rows[0].n;
    expect(conversations).toBe(1);
  });

  it("un visiteur ne peut pas l'appeler", async () => {
    await expect(ecrire("anon", FF)).rejects.toThrow(/permission denied/);
  });

  it("les outils internes ne sont pas appelables par l'API", async () => {
    await expect(banc.en({ id: E }, "select public.peut_ecrire_formateur($1)", [FF])).rejects.toThrow(/permission denied/);
    await expect(banc.en("anon", "select public.peut_ecrire_formateur($1)", [FF])).rejects.toThrow(/permission denied/);
  });
});

describe("Migration 0070 : rejouable", () => {
  it("appliquée une seconde fois, elle ne change rien", async () => {
    const avant = await lire(E, FF);
    await banc.appliquer(MIGRATION);
    expect(await lire(E, FF)).toEqual(avant);
    expect((await lire("anon", SANS))?.reseaux).toEqual({ linkedin: "https://linkedin.com/in/mireille" });
  });
});
