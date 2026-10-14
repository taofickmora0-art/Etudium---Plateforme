import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0021 : le fil « Actualités » (spec 2026-10-14-communaute-actualites). Aperçus vérifiés, tris, signets,
// tendances, activités récentes, annonce épinglée.
const MIGRATION = "supabase/migrations/0021_communaute_actualites.sql";
const REFUS = /row-level security|permission denied|Réservé à l’équipe/;

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin : Rodrigue Houngbo
const F = randomUUID(); // formateur de X (parcours P) : Mireille Akpo
const E1 = randomUUID(); // suit X : Koffi Dossou
const E2 = randomUUID(); // ne suit rien : Awa Kpadé
let P: string;

type Carte = { id: string; apercu: Record<string, unknown> | null; enregistree: boolean; aimee_par: string[] };
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const json = (v: unknown) => (v === null ? null : JSON.stringify(v));
const publier = async (qui: string, espace: string | null, texte = "Bonjour", apercu: unknown = null) =>
  (await banc.en<{ r: { id: string } }>({ id: qui }, "select public.publier($1, '', $2, null, null, $3::jsonb) as r", [espace, texte, json(apercu)]))[0].r.id;
const fil = async (qui: string, espace: string, tri = "recentes", page = 0, nombre = 20) =>
  (await banc.en<{ r: { publications: Carte[]; suite: boolean } }>({ id: qui }, "select public.fil_communaute($1, $2, null, null, $3, $4) as r", [espace, tri, page, nombre]))[0].r;
const ids = async (qui: string, espace: string, tri = "recentes") => (await fil(qui, espace, tri)).publications.map((p) => p.id);
const page = async (qui: string, id: string) => (await banc.en<{ r: Carte | null }>({ id: qui }, "select public.publication_communaute($1) as r", [id]))[0].r;
const aimer = (qui: string, id: string) => banc.en({ id: qui }, "select public.basculer_reaction($1)", [id]);
const commenter = (qui: string, id: string, texte = "Merci") => banc.en({ id: qui }, "select public.commenter($1, $2)", [id, texte]);
const enregistrer = async (qui: string, id: string) => (await banc.en<{ r: boolean }>({ id: qui }, "select public.basculer_enregistrement($1) as r", [id]))[0].r;
const vieillir = (id: string, jours: number) => banc.db.query(`update public.publications set cree_le = now() - interval '${jours} days' where id = $1`, [id]);

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
    "supabase/exemples/lot-1.sql",
    "supabase/migrations/0012_couvertures.sql",
    "supabase/migrations/0013_utilisateurs.sql",
    "supabase/migrations/0014_espace_formateur.sql",
    "supabase/migrations/0015_suivi_etudiants.sql",
    "supabase/migrations/0016_notifications.sql",
    "supabase/migrations/0017_role_unique.sql",
    "supabase/migrations/0018_sessions_live.sql",
    "supabase/migrations/0019_communaute.sql",
    "supabase/migrations/0020_moderation.sql",
    MIGRATION,
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [E1, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const [id, prenom, nom] of [[A, "Rodrigue", "Houngbo"], [F, "Mireille", "Akpo"], [E1, "Koffi", "Dossou"], [E2, "Awa", "Kpadé"]]) {
    await banc.db.query("update public.profils set prenom = $2, nom = $3 where id = $1", [id, prenom, nom]);
  }
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, 'Réussite académique', 'Académique', 'academique', -2) returning id", [`p-${randomUUID()}`])).id;
  const X = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, statut) values ('Excel', $1, $2, 'publiee') returning id", [`x-${randomUUID()}`, FA])).id;
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id) values ($1, $2)", [X, P]);
  const m = await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'M') returning id", [X]);
  const l = await un<{ id: string }>("insert into public.lecons (module_id, titre) values ($1, 'L') returning id", [m.id]);
  await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2)", [E1, l.id]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.publications");
  await banc.db.query("update public.reglages_moderation set analyse_active = false");
});

describe("Aperçus, fil, signets, tendances, activités", () => {
  it("aperçu : vérifié et rangé ; adresse ou identifiant absents du texte : aucun ; longueurs coupées ; image douteuse retirée", async () => {
    const lien = await publier(E1, null, "À lire : https://exemple.com/page ici", {
      type: "lien",
      url: "https://exemple.com/page",
      titre: "T".repeat(250),
      description: "D".repeat(400),
      image: "https://exemple.com/i.png",
    });
    expect((await page(E2, lien))?.apercu).toEqual({ type: "lien", url: "https://exemple.com/page", titre: "T".repeat(200), description: "D".repeat(300), image: "https://exemple.com/i.png" });
    const ailleurs = await publier(E1, null, "Sans adresse", { type: "lien", url: "https://piege.example/", titre: "Google Meet", description: "", image: null });
    expect((await page(E2, ailleurs))?.apercu).toBeNull();
    const douteuse = await publier(E1, null, "Voir https://exemple.com/a", { type: "lien", url: "https://exemple.com/a", titre: "A", description: "", image: "javascript:alert(1)" });
    expect((await page(E2, douteuse))?.apercu).toMatchObject({ image: null });
    const video = await publier(E1, null, "https://youtu.be/dQw4w9WgXcQ", { type: "youtube", id: "dQw4w9WgXcQ" });
    expect((await page(E2, video))?.apercu).toEqual({ type: "youtube", id: "dQw4w9WgXcQ" });
    const fausse = await publier(E1, null, "Rien", { type: "youtube", id: "dQw4w9WgXcQ" });
    expect((await page(E2, fausse))?.apercu).toBeNull();
  });

  it("fil : general, tous, un parcours ; populaires (score, puis date) par pages ; enregistrees (les siennes)", async () => {
    const g1 = await publier(E1, null, "Général 1");
    const p1 = await publier(E1, P, "Académique 1");
    const g2 = await publier(E2, null, "Général 2");
    expect(await ids(E1, "general")).toEqual([g2, g1]);
    expect(await ids(E1, "tous")).toEqual([g2, p1, g1]);
    expect(await ids(E1, P)).toEqual([p1]);
    expect(await ids(E2, P)).toEqual([]);
    for (const qui of [E2, F, A]) await aimer(qui, g1);
    await commenter(F, g2);
    await aimer(F, p1);
    expect(await ids(E1, "tous", "populaires")).toEqual([g1, g2, p1]);
    const premiere = await fil(E1, "tous", "populaires", 0, 2);
    expect([premiere.publications.map((p) => p.id), premiere.suite]).toEqual([[g1, g2], true]);
    const seconde = await fil(E1, "tous", "populaires", 1, 2);
    expect([seconde.publications.map((p) => p.id), seconde.suite]).toEqual([[p1], false]);
    // Au-delà de 30 jours, une publication ne compte plus dans « les plus populaires ».
    await vieillir(g1, 31);
    expect(await ids(E1, "tous", "populaires")).toEqual([g2, p1]);
    expect(await enregistrer(E1, g2)).toBe(true);
    expect(await enregistrer(E1, p1)).toBe(true);
    expect(await ids(E1, "tous", "enregistrees")).toEqual([p1, g2]);
    expect(await ids(E2, "tous", "enregistrees")).toEqual([]);
  });

  it("signet : bascule ; espace fermé ou publication en attente refusés ; devenue invisible, absente des enregistrements", async () => {
    const g = await publier(E2, null, "Une question");
    expect(await enregistrer(E1, g)).toBe(true);
    expect((await page(E1, g))?.enregistree).toBe(true);
    expect(await enregistrer(E1, g)).toBe(false);
    const p = await publier(E1, P, "Académique");
    await expect(enregistrer(E2, p)).rejects.toThrow("Cet espace ne vous est pas ouvert.");
    await banc.db.query("update public.reglages_moderation set analyse_active = true");
    const attente = await publier(E2, null, "En attente");
    await expect(enregistrer(E1, attente)).rejects.toThrow("Cette publication n’existe plus.");
    await enregistrer(E1, g);
    await banc.db.query("update public.publications set statut = 'en_attente' where id = $1", [g]);
    expect(await ids(E1, "tous", "enregistrees")).toEqual([]);
  });

  it("carte : aimee_par (3 initiales, du plus récent) ; enregistree pour le compte seulement", async () => {
    const g = await publier(E1, null, "Une réussite");
    for (const qui of [E2, F, A, S]) await aimer(qui, g);
    const carte = await page(E1, g);
    expect(carte?.aimee_par).toHaveLength(3);
    expect(carte?.aimee_par.slice(1)).toEqual(["RH", "MA"]);
    await enregistrer(E2, g);
    expect([(await page(E2, g))?.enregistree, (await page(E1, g))?.enregistree]).toEqual([true, false]);
  });

  it("tendances : 7 jours, espaces ouverts, publiées et aimées ou commentées seulement, dans l'ordre", async () => {
    type T = { id: string; extrait: string; auteur: { nom_court: string; initiales: string; equipe: boolean } };
    const tendances = async (qui: string) => (await banc.en<{ r: T[] }>({ id: qui }, "select public.publications_tendances() as r"))[0].r;
    const forte = await publier(E2, null, "Très aimée");
    const moyenne = await publier(A, null, "Un peu aimée");
    const fermee = await publier(E1, P, "Dans Académique");
    const vieille = await publier(F, null, "Ancienne");
    await publier(E1, null, "Sans réaction");
    for (const qui of [E1, F, A]) await aimer(qui, forte);
    await commenter(E1, moyenne);
    for (const qui of [F, A]) await aimer(qui, fermee);
    for (const qui of [E1, E2, A, S]) await aimer(qui, vieille);
    await vieillir(vieille, 8);
    expect((await tendances(E2)).map((t) => t.id)).toEqual([forte, moyenne]);
    expect((await tendances(E1)).map((t) => t.id)).toEqual([forte, fermee, moyenne]);
    expect((await tendances(E2))[1]).toEqual({ id: moyenne, extrait: "Un peu aimée", auteur: { nom_court: "Rodrigue H.", initiales: "RH", equipe: true } });
  });

  it("activités : publications et commentaires, du plus récent, 6 au plus ; espaces fermés et attente exclus", async () => {
    type Act = { type: string; publication_id: string; auteur: { nom_court: string }; extrait: string };
    const activites = async (qui: string) => (await banc.en<{ r: Act[] }>({ id: qui }, "select public.activites_recentes() as r"))[0].r;
    const g = await publier(E1, null, "Bonjour la famille");
    const p = await publier(E1, P, "Revue de littérature");
    await commenter(F, g, "Bienvenue");
    await commenter(F, p, "Bon plan");
    const deE2 = await activites(E2);
    expect(deE2.map((a) => [a.type, a.publication_id, a.auteur.nom_court])).toEqual([
      ["commentaire", g, "Mireille A."],
      ["publication", g, "Koffi D."],
    ]);
    expect(deE2[0].extrait).toBe("Bonjour la famille");
    expect(await activites(E1)).toHaveLength(4);
    for (let i = 0; i < 6; i++) await commenter(A, g, `Merci ${i}`);
    expect(await activites(E1)).toHaveLength(6);
  });

  it("les anciennes signatures n'existent plus ; la migration est rejouable ; signets fermés", async () => {
    const signatures = async (nom: string) =>
      (await banc.db.query<{ n: number }>("select pronargs as n from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace order by n", [nom])).rows.map((r) => r.n);
    expect(await signatures("fil_communaute")).toEqual([6]);
    expect(await signatures("publier")).toEqual([6]);
    expect(await signatures("modifier_publication")).toEqual([5]);
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    await expect(banc.en({ id: E1 }, "select * from public.publications_enregistrees")).rejects.toThrow(REFUS);
  });
});
