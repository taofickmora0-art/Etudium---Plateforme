import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0037 (liste du 31 octobre 2026, tâche 4) : répondre à une réponse. La réponse reste sous le même commentaire
// (un seul niveau d'affichage), mais la personne à qui l'on répond est prévenue, dans la communauté comme dans les
// discussions d'une leçon, en plus de l'auteur du commentaire (et de la publication ou du formateur), une fois chacun.

let banc: Banc;
const S = randomUUID(); // super admin
const F = randomUUID(); // formateur de la leçon
const P = randomUUID(); // auteur de la publication
const A = randomUUID(); // auteur du commentaire
const C = randomUUID(); // répond au commentaire
const K = randomUUID(); // répond à la réponse de C
let LECON: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const recues = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string }>("select titre, texte from public.notifications where destinataire = $1 and categorie = 'communaute' order by id", [qui])).rows;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie", "0036_formateur_sans_espace_etudiant", "0037_reponses_aux_reponses",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [P, []], [A, []], [C, []], [K, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const [id, prenom, nom] of [[A, "Aïcha", "Kpadé"], [C, "Awa", "Sow"], [K, "Koffi", "Dossou"]]) {
    await banc.db.query("update public.profils set prenom = $2, nom = $3 where id = $1", [id, prenom, nom]);
  }
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const f = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Canva', 'canva-0037', $1, true) returning id", [fiche])).id;
  const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module') returning id", [f])).id;
  LECON = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee) values ($1, 'Les calques', true) returning id", [m])).id;
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [f]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
});

describe("Dans la communauté", () => {
  const commenter = async (qui: string, publication: string, texte: string, parent: string | null = null) =>
    (await banc.en<{ id: string }>({ id: qui }, "select public.commenter($1, $2, $3) as id", [publication, texte, parent]))[0].id;

  it("répondre à une réponse prévient la personne à qui l'on répond, et l'auteur du commentaire, une fois chacun", async () => {
    const publication = (await banc.en<{ id: string }>({ id: P }, "select (public.publier(null, '', 'Comment trouver des clients ?', null) ->> 'id')::uuid as id"))[0].id;
    const commentaire = await commenter(A, publication, "Commence par ton entourage.");
    const reponse = await commenter(C, publication, "Bonne idée.", commentaire);
    await banc.db.query("delete from public.notifications");

    await commenter(K, publication, "@Awa S. tu as essayé LinkedIn ?", reponse);
    expect(await recues(C)).toEqual([{ titre: "Nouvelle réponse à votre commentaire", texte: "Koffi D. a répondu à votre commentaire dans l’espace général." }]);
    expect((await recues(A)).map((n) => n.titre)).toEqual(["Nouvelle réponse dans votre discussion"]);
    expect((await recues(P)).map((n) => n.titre)).toEqual(["Nouvelle réponse"]);
    expect(await recues(K)).toEqual([]);
  });

  it("répondre à sa propre réponse, ou au commentaire directement : pas de doublon", async () => {
    const publication = (await banc.en<{ id: string }>({ id: P }, "select (public.publier(null, '', 'Bonjour', null) ->> 'id')::uuid as id"))[0].id;
    const commentaire = await commenter(A, publication, "Bienvenue.");
    await banc.db.query("delete from public.notifications");
    await commenter(C, publication, "Merci !", commentaire);
    expect((await recues(A)).map((n) => n.titre)).toEqual(["Nouvelle réponse à votre commentaire"]);
    expect((await recues(P)).map((n) => n.titre)).toEqual(["Nouvelle réponse"]);
  });
});

describe("Dans les discussions d'une leçon", () => {
  const commenter = async (qui: string, texte: string, parent: string | null = null) =>
    (await banc.en<{ c: { id: string } }>({ id: qui }, "select public.commenter_lecon($1, $2, $3) as c", [LECON, texte, parent]))[0].c.id;

  it("répondre à une réponse prévient la personne à qui l'on répond, l'auteur du commentaire et le formateur", async () => {
    const commentaire = await commenter(A, "Comment fusionner deux calques ?");
    const reponse = await commenter(C, "Avec Ctrl+E.", commentaire);
    await banc.db.query("delete from public.notifications");

    await commenter(K, "@Awa S. et sur Canva gratuit ?", reponse);
    expect(await recues(C)).toEqual([{ titre: "Nouvelle réponse à votre commentaire", texte: "Koffi D. a répondu à votre commentaire sur « Les calques »." }]);
    expect((await recues(A)).map((n) => n.titre)).toEqual(["Nouvelle réponse dans votre discussion"]);
    expect((await recues(F)).map((n) => n.titre)).toEqual(["Nouveau commentaire sur votre leçon"]);
  });
});
