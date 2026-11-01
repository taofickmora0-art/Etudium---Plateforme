import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0050 (lot 2) : un abonnement actif ouvre les leçons payantes, tous les espaces de la communauté, les lives
// et leurs replays (choix 1 de la spec). L'équipe garde tout ; le formateur garde ses replays.

let banc: Banc;
const S = randomUUID(); // super admin
const E = randomUUID(); // gratuite
const A = randomUUID(); // abonnée
const X = randomUUID(); // abonnement expiré
const C = randomUUID(); // abonnement annulé
const M = randomUUID(); // modérateur
const F = randomUUID(); // formateur
let lecon: string;
let P: string;
let replay: string;
let session: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const r = async <T>(qui: string, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>({ id: qui }, sql, params))[0].r;

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
      "0044_temps_reel", "0045_sessions_fuseaux", "0046_replays", "0047_sans_achat_seul", "0048_monetisation", "0049_abonnements_paiements",
      "0050_acces_abonnes",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [E, []], [A, []], [X, []], [C, []], [M, ["moderateur"]], [F, []]] as const) {
    await banc.creerCompte(id, [...roles]);
  }
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await abonner(banc, A);
  await abonner(banc, X, { debut: "now() - interval '3 months'", fin: "now() - interval '1 minute'" });
  await abonner(banc, C, { annule: true });

  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const formation = (await un<{ id: string }>(
    "insert into public.formations (titre, slug, formateur_id, gratuite, statut) values ('Excel', $1, $2, false, 'publiee') returning id",
    [`excel-${randomUUID().slice(0, 6)}`, fiche],
  )).id;
  const module = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [formation])).id;
  lecon = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, ordre, apercu) values ($1, 'Leçon 1', true, 1, false) returning id", [module])).id;
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, 'Compétences digitales', 'Digital', 'digital', 1) returning id", [`p-${randomUUID()}`])).id;
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, 1)", [formation, P]);

  replay = (await banc.en<{ r: { id: string } }>({ id: F }, "select public.publier(null, '', 'Le replay du live Excel', null, null, null, null, null, null, true) as r"))[0].r.id;
  session = (await un<{ id: string }>(
    "insert into public.sessions_live (titre, debut, lien) values ('Live bientôt', now() + interval '5 minutes', 'https://meet.google.com/abc-defg-hij') returning id",
  )).id;
});

describe("Ce qu'ouvre un abonnement", () => {
  it("un abonnement actif ouvre les leçons payantes, pas un expiré ni un annulé", async () => {
    const acces = (qui: string) => r<boolean>(qui, "select public.acces_lecon($1) as r", [lecon]);
    expect(await acces(A)).toBe(true);
    expect(await acces(M)).toBe(true);
    expect(await acces(E)).toBe(false);
    expect(await acces(X)).toBe(false);
    expect(await acces(C)).toBe(false);
  });

  it("un abonné lit tous les espaces", async () => {
    expect(await r<boolean>(A, "select public.peut_lire_espace($1) as r", [P])).toBe(true);
    expect(await r<boolean>(E, "select public.peut_lire_espace($1) as r", [P])).toBe(false);
  });

  it("les replays : réservés aux abonnés, ouverts à leur auteur", async () => {
    const replays = async (qui: string) => (await r<{ id: string | null; ouvert: boolean }[]>(qui, "select public.espaces_communaute() as r")).find((e) => e.id === "replays");
    expect((await replays(E))?.ouvert).toBe(false);
    expect((await replays(A))?.ouvert).toBe(true);
    expect((await replays(F))?.ouvert).toBe(true);
    const fil = async (qui: string, espace: string) => (await r<{ publications: { id: string }[] }>(qui, "select public.fil_communaute($1) as r", [espace])).publications.map((p) => p.id);
    expect(await fil(E, "replays")).toEqual([]);
    expect(await fil(A, "replays")).toEqual([replay]);
    // Ni dans Actualités, ni dans le bandeau « Nouvelles publications », ni par un lien direct.
    expect(await fil(E, "tous")).not.toContain(replay);
    expect(await fil(A, "tous")).toContain(replay);
    expect((await r<{ nombre: number }>(E, "select public.nouvelles_publications('replays', null) as r")).nombre).toBe(0);
    expect((await r<{ nombre: number }>(E, "select public.nouvelles_publications('tous', null) as r")).nombre).toBe(0);
    expect(await r<unknown>(E, "select public.publication_communaute($1) as r", [replay])).toBeNull();
    expect(await r<unknown>(A, "select public.publication_communaute($1) as r", [replay])).not.toBeNull();
    await expect(banc.en({ id: E }, "select public.commenter($1, 'Merci !')", [replay])).rejects.toThrow("Cet espace ne vous est pas ouvert.");
  });

  it("les lives : inscription et lien réservés aux abonnés", async () => {
    await expect(banc.en({ id: E }, "select public.sinscrire_session($1)", [session])).rejects.toThrow("Les lives sont réservés aux abonnés.");
    await banc.en({ id: A }, "select public.sinscrire_session($1)", [session]);
    const carte = async (qui: string) =>
      (await r<{ id: string; lien: string | null; reservee: boolean }[]>(qui, "select public.sessions_live('a_venir') as r")).find((s) => s.id === session);
    expect(await carte(E)).toMatchObject({ lien: null, reservee: true });
    expect(await carte(A)).toMatchObject({ lien: "https://meet.google.com/abc-defg-hij", reservee: false });
  });
});
