import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0024 (spec promotion des sessions live) : une session programmée paraît dans la communauté, avec son visuel
// (affiche ou vidéo) et son bloc ; « nouvelles sessions » pour la pastille rouge.

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur « Mireille Akpo »
const E = randomUUID(); // étudiant
let FA: string;
let P: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const LIEN = "https://meet.google.com/abc-defg-hij";
const VIDEO = { plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" };

/** Un fichier déposé par `qui` dans son dossier du stockage « communaute ». */
async function deposer(qui: string, type = "image/png", taille = 2048) {
  const chemin = `${qui}/${randomUUID()}.${type === "application/pdf" ? "pdf" : "png"}`;
  await banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('communaute', $1, $2, $3::jsonb)", [
    chemin,
    qui,
    JSON.stringify({ mimetype: type, size: taille }),
  ]);
  return { chemin, nom: "affiche.png", type, taille };
}

type Creation = { titre?: string; description?: string; parcours?: string | null; image?: unknown; video?: unknown; debutDans?: string };
const creer = async (qui: string, c: Creation = {}) =>
  (
    await banc.en<{ id: string }>(
      { id: qui },
      "select public.creer_session($1, $2, now() + $3::interval, 60, $4, $5, null, $6::jsonb, $7::jsonb) as id",
      [c.titre ?? "Excel avancé", c.description ?? "", c.debutDans ?? "2 days", LIEN, c.parcours ?? null, c.image ? JSON.stringify(c.image) : null, c.video ? JSON.stringify(c.video) : null],
    )
  )[0].id;
const modifier = async (qui: string, id: string, c: Creation) => {
  // Le même début : la base ne le revérifie pas.
  const { debut } = await un<{ debut: string }>("select debut::text as debut from public.sessions_live where id = $1", [id]);
  return banc.en(
    { id: qui },
    "select public.modifier_session($1, $2, $3, $4::timestamptz, 60, $5, $6, $7, $8::jsonb, $9::jsonb)",
    [id, c.titre ?? "Excel avancé", c.description ?? "", debut, LIEN, c.parcours ?? null, FA, c.image ? JSON.stringify(c.image) : null, c.video ? JSON.stringify(c.video) : null],
  );
};
type Pub = { id: string; auteur: string; parcours_id: string | null; titre: string; texte: string; piece_jointe: { chemin: string } | null; video: unknown; statut: string };
const publicationDe = (session: string) =>
  un<Pub>("select id, auteur, parcours_id, titre, texte, piece_jointe, video, statut from public.publications where session_id = $1", [session]);
const carte = async (qui: string, publication: string) =>
  (await banc.en<{ c: { session: Record<string, unknown> | null } }>({ id: qui }, "select public.publication_communaute($1) as c", [publication]))[0].c;
const nouvelles = async (qui: string) => (await banc.en<{ n: number }>({ id: qui }, "select public.nouvelles_sessions() as n"))[0].n;

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
    "supabase/migrations/0021_communaute_actualites.sql",
    "supabase/migrations/0022_communaute_video.sql",
    "supabase/migrations/0023_sessions_rappels.sql",
    "supabase/migrations/0024_sessions_promotion.sql",
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Akpo' where id = $1", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur) values ($1, 'Réussite académique', 'Académique', 'academique') returning id", [`p-${randomUUID()}`])).id;
});

beforeEach(async () => {
  await banc.db.query("delete from public.publications");
  await banc.db.query("delete from public.sessions_live");
  await banc.db.query("update public.profils set evenements_vus_le = null");
});

describe("La session paraît dans la communauté", () => {
  it("programmer publie : auteur, espace du parcours, titre, description, affiche", async () => {
    const affiche = await deposer(F);
    const id = await creer(F, { titre: "Excel avancé", description: "Tableaux croisés dynamiques.", parcours: P, image: affiche });
    const pub = await publicationDe(id);
    expect(pub).toMatchObject({ auteur: F, parcours_id: P, titre: "Excel avancé", texte: "Tableaux croisés dynamiques.", statut: "publiee", video: null });
    expect(pub.piece_jointe?.chemin).toBe(affiche.chemin);
    const { pid } = await un<{ pid: string }>("select publication_id as pid from public.sessions_live where id = $1", [id]);
    expect(pid).toBe(pub.id);
  });

  it("« Tous les parcours » : dans Général ; sans description : « Session live programmée. » ; une vidéo de promotion", async () => {
    const id = await creer(S, { video: VIDEO });
    const pub = await publicationDe(id);
    expect(pub).toMatchObject({ parcours_id: null, texte: "Session live programmée.", piece_jointe: null });
    expect(pub.video).toMatchObject({ plateforme: "youtube", id: "dQw4w9WgXcQ" });
  });

  it("une affiche ou une vidéo, pas les deux ; l'affiche est une image du dossier du compte", async () => {
    await expect(creer(F, { image: await deposer(F), video: VIDEO })).rejects.toThrow("Choisissez une affiche ou une vidéo, pas les deux.");
    await expect(creer(F, { image: await deposer(F, "application/pdf") })).rejects.toThrow("L’affiche doit être une image (JPG, PNG ou WebP).");
    await expect(creer(F, { image: await deposer(S) })).rejects.toThrow("Ce fichier n’est pas le vôtre.");
    expect((await un<{ n: number }>("select count(*)::int as n from public.sessions_live")).n).toBe(0);
  });

  it("modifier met à jour la publication ; la même affiche est gardée, une nouvelle la remplace", async () => {
    const affiche = await deposer(F);
    const id = await creer(F, { image: affiche, parcours: P });
    await modifier(F, id, { titre: "Excel expert", description: "Nouveau programme.", image: affiche, parcours: P });
    let pub = await publicationDe(id);
    expect(pub).toMatchObject({ titre: "Excel expert", texte: "Nouveau programme." });
    expect(pub.piece_jointe?.chemin).toBe(affiche.chemin);
    const autre = await deposer(F);
    await modifier(F, id, { image: autre, parcours: P });
    pub = await publicationDe(id);
    expect(pub.piece_jointe?.chemin).toBe(autre.chemin);
    await modifier(F, id, { video: VIDEO, parcours: P });
    pub = await publicationDe(id);
    expect(pub.piece_jointe).toBeNull();
    expect(pub.video).toMatchObject({ plateforme: "youtube" });
  });

  it("la carte rend le bloc de la session : plateforme, animateur, inscrits ; « annulee » après l'annulation", async () => {
    const id = await creer(F, { parcours: null });
    const pub = await publicationDe(id);
    await banc.en({ id: E }, "select public.sinscrire_session($1)", [id]);
    const bloc = (await carte(E, pub.id)).session;
    expect(bloc).toMatchObject({ id, plateforme: "Google Meet", animateur: "Mireille Akpo", statut: "programmee", inscriptions: 1, inscrit: true, duree_minutes: 60 });
    expect(bloc).not.toHaveProperty("lien");
    await banc.en({ id: F }, "select public.annuler_session($1)", [id]);
    expect((await carte(E, pub.id)).session).toMatchObject({ statut: "annulee" });
  });

  it("une publication ordinaire n'a pas de bloc de session", async () => {
    const { id } = await un<{ id: string }>("insert into public.publications (auteur, texte) values ($1, 'Bonjour') returning id", [E]);
    expect((await carte(E, id)).session).toBeNull();
  });

  it("session_detail rend le visuel de promotion", async () => {
    const id = await creer(F, { video: VIDEO });
    const d = (await banc.en<{ d: Record<string, unknown> }>({ id: F }, "select public.session_detail($1) as d", [id]))[0].d;
    expect(d.promo_video).toMatchObject({ plateforme: "youtube" });
    expect(d.promo_image).toBeNull();
  });
});

describe("Nouvelles sessions (pastille rouge)", () => {
  it("compte les sessions programmées depuis la dernière visite des Événements, pas les siennes ni les annulées ni les passées", async () => {
    await creer(F, { titre: "Une" });
    const annulee = await creer(F, { titre: "Annulée" });
    await banc.en({ id: F }, "select public.annuler_session($1)", [annulee]);
    await banc.db.query(
      "insert into public.sessions_live (titre, debut, duree_minutes, lien, cree_par) values ('Passée', now() - interval '3 hours', 60, $1, $2)",
      [LIEN, F],
    );
    expect(await nouvelles(E)).toBe(1);
    // Ses propres sessions ne comptent pas.
    expect(await nouvelles(F)).toBe(0);
    await banc.en({ id: E }, "select public.marquer_evenements_vus()");
    expect(await nouvelles(E)).toBe(0);
    await creer(S, { titre: "Deux" });
    expect(await nouvelles(E)).toBe(1);
  });

  it("réservé aux comptes connectés", async () => {
    await expect(banc.en("anon", "select public.nouvelles_sessions()")).rejects.toThrow(/permission denied/);
    await expect(banc.en("anon", "select public.marquer_evenements_vus()")).rejects.toThrow(/permission denied/);
  });
});
