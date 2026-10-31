import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0046 (liste du 31 octobre 2026, tâche 11) : l'espace « Replays de live » de la communauté. Tout le monde le
// lit (et le retrouve dans Actualités) ; seuls l'équipe et les formateurs y publient.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur
const E = randomUUID(); // étudiante
let P: string; // un parcours

type Espace = { id: string | null; nom: string; nom_court: string; ouvert: boolean; publier?: boolean };
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const espaces = async (qui: string) => (await banc.en<{ r: Espace[] }>({ id: qui }, "select public.espaces_communaute() as r"))[0].r;
const publier = async (qui: string, replay: boolean, parcours: string | null = null) =>
  (await banc.en<{ r: { id: string } }>({ id: qui }, "select public.publier($1, '', 'Le replay du live Excel', null, null, null, null, null, null, $2) as r", [parcours, replay]))[0].r.id;
const fil = async (qui: string, espace: string) =>
  (await banc.en<{ r: { publications: { id: string; espace: { id: string | null; nom: string } }[] } }>({ id: qui }, "select public.fil_communaute($1) as r", [espace]))[0].r.publications;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie", "0036_formateur_sans_espace_etudiant", "0037_reponses_aux_reponses", "0038_photos_communaute", "0039_annonce_masquable",
      "0040_photos_colonne_communaute", "0041_notifications_communaute", "0042_nouvelles_publications", "0043_nouvelles_publications_siennes",
      "0044_temps_reel", "0045_sessions_fuseaux", "0046_replays",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, 'Compétences digitales', 'Digital', 'digital', 1) returning id", [`p-${randomUUID()}`])).id;
});

beforeEach(async () => {
  await banc.db.query("delete from public.publications");
  await banc.db.query("update public.reglages_moderation set analyse_active = false");
});

describe("L'espace « Replays de live »", () => {
  it("le dernier des espaces, ouvert à tous ; « publier » : l'équipe et les formateurs seulement", async () => {
    const pourE = await espaces(E);
    expect(pourE.at(-1)).toEqual({ id: "replays", nom: "Replays de live", nom_court: "Replays", couleur: null, slug: null, ouvert: true, publier: false });
    expect(pourE[0]).toMatchObject({ id: null, nom: "Général" });
    expect((await espaces(S)).at(-1)).toMatchObject({ id: "replays", publier: true });
    expect((await espaces(F)).at(-1)).toMatchObject({ id: "replays", publier: true });
  });

  it("un étudiant ne peut pas y publier ; l'équipe et un formateur, si (jamais dans un parcours en même temps)", async () => {
    await expect(publier(E, true)).rejects.toThrow("Les replays sont publiés par l’équipe Étudium et les formateurs.");
    const parEquipe = await publier(S, true);
    const parFormateur = await publier(F, true, P);
    const lignes = (await banc.db.query<{ id: string; replay: boolean; parcours_id: string | null }>("select id, replay, parcours_id from public.publications order by cree_le")).rows;
    expect(lignes).toEqual([
      { id: parEquipe, replay: true, parcours_id: null },
      { id: parFormateur, replay: true, parcours_id: null },
    ]);
  });

  it("le fil « replays » : ses publications seulement ; « Général » ne les montre plus ; Actualités, si", async () => {
    const replay = await publier(S, true);
    const generale = (await banc.en<{ r: { id: string } }>({ id: E }, "select public.publier(null, '', 'Bonjour à tous', null) as r"))[0].r.id;
    expect((await fil(E, "replays")).map((p) => p.id)).toEqual([replay]);
    expect((await fil(E, "general")).map((p) => p.id)).toEqual([generale]);
    expect((await fil(E, "tous")).map((p) => p.id).sort()).toEqual([replay, generale].sort());
    const [carte] = await fil(E, "replays");
    expect(carte.espace).toEqual({ id: "replays", nom: "Replays de live" });
  });

  it("le bandeau « Nouvelles publications » compte les replays dans leur espace, pas dans Général", async () => {
    await publier(S, true);
    const n = async (espace: string) => (await banc.en<{ r: { nombre: number } }>({ id: E }, "select public.nouvelles_publications($1, null) as r", [espace]))[0].r.nombre;
    expect(await n("replays")).toBe(1);
    expect(await n("general")).toBe(0);
    expect(await n("tous")).toBe(1);
  });
});
