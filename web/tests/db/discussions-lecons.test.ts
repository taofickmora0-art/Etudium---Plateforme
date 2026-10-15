import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0028 (refonte des formations, étape B) : les discussions des leçons — lire et écrire avec l'accès à la
// leçon, un seul niveau de réponses, J'aime, droits de suppression, notifications, limite, signalements dans la file.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const E = randomUUID(); // étudiant
const A = randomUUID(); // autre étudiant
let LECON: string; // leçon d'une formation gratuite (accessible aux comptes)
let PAYANTE: string; // leçon d'une formation payante (fermée aux étudiants)

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
type Carte = { id: string; parent_id: string | null; texte: string; formateur: boolean; peut_supprimer: boolean; peut_modifier: boolean; reactions: number; j_aime: boolean };
const commenter = async (qui: string, lecon: string, texte: string, parent: string | null = null) =>
  (await banc.en<{ c: Carte }>({ id: qui }, "select public.commenter_lecon($1, $2, $3) as c", [lecon, texte, parent]))[0].c;
const discussion = async (qui: string, lecon: string, tout = true) =>
  (await banc.en<{ d: { total: number; commentaires: Carte[] } | null }>({ id: qui }, "select public.discussion_lecon($1, $2) as d", [lecon, tout]))[0].d;
const notifications = async (qui: string) =>
  (await banc.db.query<{ titre: string; lien: string }>("select titre, lien from public.notifications where destinataire = $1 and categorie = 'communaute' order by id", [qui])).rows;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E, []], [A, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const formation = async (slug: string, gratuite: boolean) => {
    const f = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ($1, $1, $2, $3) returning id", [slug, fiche, gratuite])).id;
    const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module') returning id", [f])).id;
    const l = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee) values ($1, 'Installer les outils', true) returning id", [m])).id;
    await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [f]);
    return l;
  };
  LECON = await formation("gratuite-0028", true);
  PAYANTE = await formation("payante-0028", false);
});

describe("Les discussions d'une leçon", () => {
  it("un compte qui a accès lit et écrit ; sans accès : ni lecture ni écriture", async () => {
    const c = await commenter(E, LECON, "  Très clair, merci !  ");
    expect(c).toMatchObject({ texte: "Très clair, merci !", parent_id: null, formateur: false, peut_supprimer: true, peut_modifier: true });
    expect((await discussion(A, LECON))?.commentaires.map((x) => x.texte)).toContain("Très clair, merci !");
    await expect(commenter(E, PAYANTE, "Bonjour")).rejects.toThrow("Cette leçon ne vous est pas ouverte.");
    expect(await discussion(E, PAYANTE)).toBeNull();
    expect((await banc.en<{ d: unknown }>("anon", "select public.discussion_lecon($1, true) as d", [LECON]))[0].d).toBeNull();
  });

  it("une réponse à une réponse reste au premier niveau ; le formateur porte son étiquette", async () => {
    const parent = await commenter(E, LECON, "Où trouver le lien ?");
    const reponse = await commenter(F, LECON, "Dans les documents de la leçon.", parent.id);
    expect(reponse).toMatchObject({ parent_id: parent.id, formateur: true });
    const sous = await commenter(A, LECON, "Merci !", reponse.id);
    expect(sous.parent_id).toBe(parent.id);
  });

  it("notifications : le formateur à un nouveau commentaire, l'auteur à une réponse (pas de doublon)", async () => {
    const avantF = (await notifications(F)).length;
    const avantE = (await notifications(E)).length;
    const parent = await commenter(E, LECON, "Une question");
    expect((await notifications(F)).slice(avantF)).toEqual([
      { titre: "Nouveau commentaire sur votre leçon", lien: expect.stringMatching(new RegExp(`^/formations/gratuite-0028/lecons/${LECON}#commentaire-${parent.id}$`)) },
    ]);
    await commenter(F, LECON, "Une réponse", parent.id);
    expect((await notifications(E)).slice(avantE)).toEqual([{ titre: "Nouvelle réponse à votre commentaire", lien: expect.stringContaining("#commentaire-") }]);
    expect((await notifications(F)).slice(avantF)).toHaveLength(1);
  });

  it("modifier : l'auteur ; supprimer : l'auteur, le formateur de la formation, l'équipe ; un autre étudiant, non", async () => {
    const c = await commenter(E, LECON, "Brouillon de question");
    await banc.en({ id: E }, "select public.modifier_commentaire_lecon($1, $2)", [c.id, "Question corrigée"]);
    await expect(banc.en({ id: A }, "select public.modifier_commentaire_lecon($1, $2)", [c.id, "Pirate"])).rejects.toThrow("Ce commentaire n’est pas le vôtre.");
    await expect(banc.en({ id: A }, "select public.supprimer_commentaire_lecon($1)", [c.id])).rejects.toThrow("Ce commentaire n’est pas le vôtre.");
    const r = await commenter(A, LECON, "Réponse", c.id);
    expect((await banc.en<{ n: number }>({ id: F }, "select public.supprimer_commentaire_lecon($1) as n", [c.id]))[0].n).toBe(2);
    expect(await un("select count(*)::int as n from public.commentaires_lecons where id = any($1)", [[c.id, r.id]])).toEqual({ n: 0 });
    const d = await commenter(A, LECON, "À retirer");
    expect((await banc.en<{ n: number }>({ id: S }, "select public.supprimer_commentaire_lecon($1) as n", [d.id]))[0].n).toBe(1);
  });

  it("J'aime : le premier clic l'ajoute, le second le retire", async () => {
    const c = await commenter(E, LECON, "Merci");
    expect((await banc.en<{ r: unknown }>({ id: A }, "select public.basculer_reaction_commentaire_lecon($1) as r", [c.id]))[0].r).toEqual({ j_aime: true, reactions: 1 });
    expect((await banc.en<{ r: unknown }>({ id: A }, "select public.basculer_reaction_commentaire_lecon($1) as r", [c.id]))[0].r).toEqual({ j_aime: false, reactions: 0 });
  });

  it("commentaires fermés sur la leçon : ni écriture, ni lecture", async () => {
    await banc.db.query("update public.lecons set commentaires_actifs = false where id = $1", [LECON]);
    await expect(commenter(E, LECON, "Bonjour")).rejects.toThrow("Les commentaires sont fermés sur cette leçon.");
    expect(await discussion(E, LECON)).toBeNull();
    await banc.db.query("update public.lecons set commentaires_actifs = true where id = $1", [LECON]);
  });

  it("la première page : les 10 derniers commentaires et leurs réponses ; le total compte tout", async () => {
    for (let i = 0; i < 12; i++) await banc.db.query("insert into public.commentaires_lecons (lecon_id, auteur, texte, cree_le) values ($1, $2, $3, now() + ($4 || ' minutes')::interval)", [LECON, A, `Page ${i}`, String(i)]);
    const premiere = await discussion(E, LECON, false);
    const tout = await discussion(E, LECON, true);
    expect(premiere!.commentaires.filter((c) => c.parent_id === null)).toHaveLength(10);
    expect(premiere!.commentaires.at(-1)?.texte).toBe("Page 11");
    expect(premiere!.total).toBe(tout!.total);
    expect(tout!.commentaires.length).toBe(tout!.total);
  });

  it("au plus 30 commentaires en 10 minutes", async () => {
    await banc.db.query("insert into public.commentaires_lecons (lecon_id, auteur, texte) select $1, $2, 'x' from generate_series(1, 30)", [LECON, S]);
    await expect(commenter(S, LECON, "Un de trop")).rejects.toThrow("Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.");
  });
});

describe("Signaler un commentaire de leçon", () => {
  it("il entre dans la file de l'équipe ; « Garder » l'en sort ; « Retirer » le supprime et prévient son auteur", async () => {
    const c = await commenter(A, LECON, "Contenu douteux");
    await expect(banc.en({ id: A }, "select public.signaler_commentaire_lecon($1, 'spam', '')", [c.id])).rejects.toThrow("Vous ne pouvez pas signaler votre propre contenu.");
    await banc.en({ id: E }, "select public.signaler_commentaire_lecon($1, 'spam', '')", [c.id]);
    await expect(banc.en({ id: E }, "select public.signaler_commentaire_lecon($1, 'spam', '')", [c.id])).rejects.toThrow("Vous avez déjà signalé ce contenu.");
    const file = async () => (await banc.en<{ f: { type: string; id: string; lien: string }[] }>({ id: S }, "select public.file_moderation('a_examiner') as f"))[0].f;
    expect(await file()).toContainEqual(expect.objectContaining({ type: "commentaire_lecon", id: c.id, lien: `/formations/gratuite-0028/lecons/${LECON}#commentaire-${c.id}` }));
    expect((await banc.en<{ n: number }>({ id: S }, "select public.nombre_a_examiner() as n"))[0].n).toBeGreaterThanOrEqual(1);
    await banc.en({ id: S }, "select public.garder_commentaire_lecon($1)", [c.id]);
    expect((await file()).map((e) => e.id)).not.toContain(c.id);
    const d = await commenter(A, LECON, "Vraiment douteux");
    await banc.en({ id: E }, "select public.signaler_commentaire_lecon($1, 'harcelement', '')", [d.id]);
    await banc.en({ id: S }, "select public.retirer_commentaire_lecon($1)", [d.id]);
    expect(await un("select count(*)::int as n from public.commentaires_lecons where id = $1", [d.id])).toEqual({ n: 0 });
    expect(await un("select titre from public.notifications where destinataire = $1 and categorie = 'service' order by id desc limit 1", [A])).toEqual({ titre: "Commentaire retiré" });
    await expect(banc.en({ id: E }, "select public.retirer_commentaire_lecon($1)", [c.id])).rejects.toThrow();
  });

  it("la 0028 se rejoue", async () => {
    await banc.appliquer("supabase/migrations/0028_discussions_lecons.sql");
    expect(await discussion(E, LECON)).not.toBeNull();
  });
});
