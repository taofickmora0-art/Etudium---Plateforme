import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0041 (liste du 31 octobre 2026, tâche 8) : les notifications de la communauté. Un J'aime prévient l'auteur
// de la publication ou du commentaire (une seule notification non lue par contenu, mise à jour) ; une publication
// programmée qui paraît prévient son auteur, une fois.

let banc: Banc;
const S = randomUUID();
const F = randomUUID(); // formateur de la leçon
const A = randomUUID(); // auteur
const B = randomUUID();
const C = randomUUID();
let LECON: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const nonLues = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string }>(
    "select titre, texte, lien from public.notifications where destinataire = $1 and categorie = 'communaute' and lue_le is null order by id",
    [qui],
  )).rows;
const publier = async (qui: string, texte: string) => (await banc.en<{ id: string }>({ id: qui }, "select (public.publier(null, '', $1, null) ->> 'id')::uuid as id", [texte]))[0].id;

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
      "0040_photos_colonne_communaute", "0041_notifications_communaute",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [A, []], [B, []], [C, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const [id, prenom, nom] of [[A, "Aïcha", "Kpadé"], [B, "Taofick", "Mora"], [C, "Nadia", "Sossa"]]) {
    await banc.db.query("update public.profils set prenom = $2, nom = $3 where id = $1", [id, prenom, nom]);
  }
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const f = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Canva', 'canva-0041', $1, true) returning id", [fiche])).id;
  const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module') returning id", [f])).id;
  LECON = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee) values ($1, 'Les calques', true) returning id", [m])).id;
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [f]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
});

describe("Les J'aime", () => {
  it("une publication aimée prévient son auteur ; une seule notification non lue, mise à jour ; retirer ou s'aimer soi-même : rien", async () => {
    const id = await publier(A, "Mon premier visuel sur Canva");
    await banc.en({ id: B }, "select public.basculer_reaction($1)", [id]);
    expect(await nonLues(A)).toEqual([{ titre: "Taofick M. aime votre publication", texte: "« Mon premier visuel sur Canva »", lien: `/communaute/publications/${id}` }]);
    await banc.en({ id: C }, "select public.basculer_reaction($1)", [id]);
    expect((await nonLues(A)).map((n) => n.titre)).toEqual(["Nadia S. et une autre personne aiment votre publication"]);
    await banc.en({ id: C }, "select public.basculer_reaction($1)", [id]); // retiré
    await banc.en({ id: A }, "select public.basculer_reaction($1)", [id]); // le sien
    expect((await nonLues(A)).map((n) => n.titre)).toEqual(["Nadia S. et une autre personne aiment votre publication"]);
  });

  it("un commentaire aimé prévient son auteur, dans la communauté comme dans une leçon", async () => {
    const id = await publier(A, "Bonjour");
    const commentaire = (await banc.en<{ id: string }>({ id: C }, "select public.commenter($1, 'Bienvenue !', null) as id", [id]))[0].id;
    await banc.db.query("delete from public.notifications");
    await banc.en({ id: B }, "select public.basculer_reaction_commentaire($1)", [commentaire]);
    expect(await nonLues(C)).toEqual([{ titre: "Taofick M. aime votre commentaire", texte: "« Bienvenue ! »", lien: `/communaute/publications/${id}#commentaire-${commentaire}` }]);

    const c = (await banc.en<{ c: { id: string } }>({ id: A }, "select public.commenter_lecon($1, 'Merci pour la leçon', null) as c", [LECON]))[0].c.id;
    await banc.db.query("delete from public.notifications");
    await banc.en({ id: B }, "select public.basculer_reaction_commentaire_lecon($1)", [c]);
    const [n] = await nonLues(A);
    expect(n.titre).toBe("Taofick M. aime votre commentaire");
    expect(n.lien).toMatch(new RegExp(`/formations/canva-0041/lecons/${LECON}#commentaire-${c}$`));
  });
});

describe("L'extrait d'une notification", () => {
  it("sans la mise en forme (gras, barré, liens), sur une ligne, 80 caractères au plus", async () => {
    const extrait = async (t: string) => (await un<{ e: string }>("select public.extrait_notification($1) as e", [t])).e;
    expect(await extrait("**Gras** et [mon lien](https://exemple.com)\n> Citation")).toBe("Gras et mon lien Citation");
    expect(await extrait("x".repeat(100))).toBe(`${"x".repeat(79)}…`);
  });
});

describe("Les publications programmées", () => {
  it("à sa parution, son auteur est prévenu, une seule fois ; une publication ordinaire : rien", async () => {
    const programmee = (await un<{ id: string }>(
      "insert into public.publications (auteur, texte, statut, cree_le, ecrite_le) values ($1, 'Le live de samedi', 'publiee', now() - interval '1 minute', now() - interval '2 hours') returning id",
      [A],
    )).id;
    await un("insert into public.publications (auteur, texte, statut, cree_le, ecrite_le) values ($1, 'Ordinaire', 'publiee', now(), now()) returning id", [A]);
    await banc.db.query("select public.traiter_publications_programmees()");
    expect(await nonLues(A)).toEqual([{ titre: "Votre publication programmée est parue", texte: "« Le live de samedi »", lien: `/communaute/publications/${programmee}` }]);
    await banc.db.query("select public.traiter_publications_programmees()");
    expect(await nonLues(A)).toHaveLength(1);
  });

  it("la cloche déclenche aussi le traitement (rappels_sessions)", async () => {
    await un(
      "insert into public.publications (auteur, texte, statut, cree_le, ecrite_le) values ($1, 'Autre programmée', 'publiee', now() - interval '1 minute', now() - interval '1 hour') returning id",
      [A],
    );
    await banc.en({ id: A }, "select public.rappels_sessions()");
    expect((await nonLues(A)).map((n) => n.titre)).toEqual(["Votre publication programmée est parue"]);
  });
});
