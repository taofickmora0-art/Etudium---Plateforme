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

describe("L'annonce épinglée", () => {
  type Donnees = { active: boolean; titre: string; texte: string; media: string | null; youtube_id: string | null; image_chemin: string | null; public: string; parcours: string | null };
  const BASE: Donnees = { active: true, titre: "Bienvenue", texte: "Cinq minutes pour bien démarrer.", media: "youtube", youtube_id: "dQw4w9WgXcQ", image_chemin: null, public: "tous", parcours: null };
  const lire = async (qui: string) => (await banc.en<{ r: Record<string, unknown> | null }>({ id: qui }, "select public.annonce_communaute() as r"))[0].r;
  const ecrire = (qui: string, d: Partial<Donnees>) => {
    const a = { ...BASE, ...d };
    return banc.en({ id: qui }, "select public.enregistrer_annonce($1, $2, $3, $4, $5, $6, $7, $8)", [a.active, a.titre, a.texte, a.media, a.youtube_id, a.image_chemin, a.public, a.parcours]);
  };
  const deposer = (qui: string, chemin: string, type = "image/png", taille = 1000) =>
    banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('communaute', $1, $2, $3::jsonb)", [chemin, qui, JSON.stringify({ mimetype: type, size: taille })]);
  const lit = async (qui: string, chemin: string) => (await banc.en({ id: qui }, "select name from storage.objects where bucket_id = 'communaute' and name = $1", [chemin])).length;

  beforeEach(async () => {
    await banc.en({ id: A }, "select public.retirer_annonce()");
  });

  it("inactive : rien ; tous ; un parcours : visible de qui en lit l'espace ; l'équipe seule lit et écrit le réglage", async () => {
    expect(await lire(E1)).toBeNull();
    await ecrire(A, {});
    expect(await lire(E2)).toEqual({ titre: "Bienvenue", texte: "Cinq minutes pour bien démarrer.", media: "youtube", youtube_id: "dQw4w9WgXcQ", image_chemin: null });
    await ecrire(A, { public: "parcours", parcours: P });
    expect([await lire(E1), await lire(E2)]).toEqual([expect.objectContaining({ titre: "Bienvenue" }), null]);
    await ecrire(A, { active: false, public: "parcours", parcours: P });
    expect(await lire(E1)).toBeNull();
    expect((await banc.en<{ r: Record<string, unknown> }>({ id: A }, "select public.annonce_equipe() as r"))[0].r).toMatchObject({ active: false, titre: "Bienvenue", public: "parcours", parcours_id: P });
    await expect(ecrire(E1, {})).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E1 }, "select public.annonce_equipe()")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E1 }, "select public.retirer_annonce()")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E1 }, "select * from public.annonce_communaute")).rejects.toThrow(REFUS);
  });

  it("validations : titre, texte, YouTube, affiche, parcours", async () => {
    await expect(ecrire(A, { titre: " " })).rejects.toThrow("Écrivez le titre de l’annonce (120 caractères au plus).");
    await expect(ecrire(A, { titre: "x".repeat(121) })).rejects.toThrow("Écrivez le titre de l’annonce (120 caractères au plus).");
    await expect(ecrire(A, { texte: "x".repeat(501) })).rejects.toThrow("Le texte de l’annonce dépasse 500 caractères.");
    await expect(ecrire(A, { youtube_id: "pas-un-id" })).rejects.toThrow("Cette adresse YouTube n’est pas reconnue.");
    const IMAGE = "Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus.";
    await expect(ecrire(A, { media: "image", youtube_id: null, image_chemin: `${A}/absente.png` })).rejects.toThrow(IMAGE);
    const pdf = `${A}/${randomUUID()}.pdf`;
    await deposer(A, pdf, "application/pdf");
    await expect(ecrire(A, { media: "image", youtube_id: null, image_chemin: pdf })).rejects.toThrow(IMAGE);
    const autre = `${E1}/${randomUUID()}.png`;
    await deposer(E1, autre);
    await expect(ecrire(A, { media: "image", youtube_id: null, image_chemin: autre })).rejects.toThrow(IMAGE);
    await expect(ecrire(A, { public: "parcours", parcours: null })).rejects.toThrow("Choisissez un parcours.");
  });

  it("l'affiche : lisible selon le public ; retirer l'annonce rend son chemin et la ferme", async () => {
    const affiche = `${A}/${randomUUID()}.png`;
    await deposer(A, affiche);
    await ecrire(A, { media: "image", youtube_id: null, image_chemin: affiche });
    expect(await lire(E2)).toMatchObject({ media: "image", image_chemin: affiche, youtube_id: null });
    expect([await lit(E1, affiche), await lit(E2, affiche)]).toEqual([1, 1]);
    await ecrire(A, { media: "image", youtube_id: null, image_chemin: affiche, public: "parcours", parcours: P });
    expect([await lit(E1, affiche), await lit(E2, affiche)]).toEqual([1, 0]);
    expect((await banc.en<{ r: string | null }>({ id: A }, "select public.retirer_annonce() as r"))[0].r).toBe(affiche);
    expect(await lire(E1)).toBeNull();
    expect(await lit(E1, affiche)).toBe(0);
  });

  it("un autre membre de l'équipe garde l'affiche déjà enregistrée ; une autre image du dossier d'autrui reste refusée", async () => {
    const affiche = `${A}/${randomUUID()}.png`;
    await deposer(A, affiche);
    await ecrire(A, { media: "image", youtube_id: null, image_chemin: affiche });
    await ecrire(S, { active: false, titre: "Corrigé", media: "image", youtube_id: null, image_chemin: affiche });
    expect((await banc.en<{ r: Record<string, unknown> }>({ id: A }, "select public.annonce_equipe() as r"))[0].r).toMatchObject({ active: false, titre: "Corrigé", image_chemin: affiche });
    const autre = `${A}/${randomUUID()}.png`;
    await deposer(A, autre);
    await expect(ecrire(S, { media: "image", youtube_id: null, image_chemin: autre })).rejects.toThrow("Choisissez une image JPEG, PNG ou WebP de 10 Mo au plus.");
  });
});

describe("La lecture des aperçus (reserver_apercu)", () => {
  type Reservation = { lire: boolean; actuel: Record<string, unknown> | null };
  const reserver = async (qui: string, publication: string | null, parcours: string | null, adresse: string) =>
    (await banc.en<{ r: Reservation }>({ id: qui }, "select public.reserver_apercu($1, $2, $3) as r", [publication, parcours, adresse]))[0].r;
  const U = "https://exemple.com/page";

  beforeEach(async () => {
    await banc.db.query("delete from public.lectures_apercu");
  });

  it("modifier : la sienne seulement ; même lien : l'aperçu actuel, sans lecture ; autre lien : une lecture", async () => {
    const id = await publier(E1, null, `À lire : ${U}`, { type: "lien", url: U, titre: "Page", description: "", image: null });
    await expect(reserver(E2, id, null, "https://autre.example/")).rejects.toThrow("Cette publication n’est pas la vôtre.");
    await expect(reserver(E1, randomUUID(), null, U)).rejects.toThrow("Cette publication n’existe plus.");
    expect(await reserver(E1, id, null, U)).toEqual({ lire: false, actuel: expect.objectContaining({ type: "lien", url: U }) });
    expect(await reserver(E1, id, null, "https://autre.example/")).toEqual({ lire: true, actuel: expect.objectContaining({ url: U }) });
    expect(Number((await un<{ n: number }>("select count(*)::int as n from public.lectures_apercu")).n)).toBe(1);
  });

  it("publier : un espace ouvert, la limite des publications, puis 20 lectures par 10 minutes ; la table est fermée", async () => {
    await expect(reserver(E2, null, P, U)).rejects.toThrow("Cet espace ne vous est pas ouvert.");
    for (let i = 0; i < 20; i++) expect(await reserver(E2, null, null, `${U}?${i}`)).toEqual({ lire: true, actuel: null });
    expect(await reserver(E2, null, null, U)).toEqual({ lire: false, actuel: null });
    for (let i = 0; i < 5; i++) await publier(E1, null, `Message ${i}`);
    await expect(reserver(E1, null, null, U)).rejects.toThrow("Vous publiez beaucoup en peu de temps.");
    await expect(banc.en({ id: E1 }, "select * from public.lectures_apercu")).rejects.toThrow(REFUS);
  });
});
