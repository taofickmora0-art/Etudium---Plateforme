import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0038 (liste du 31 octobre 2026, tâche 5) : les photos de profil dans la communauté. Jusqu'ici, seule sa
// propre photo s'affichait (l'appli la connaît) : la base renvoie maintenant celle de l'auteur d'une publication, des
// derniers qui l'aiment et de l'auteur d'un commentaire (communauté et discussions d'une leçon).

let banc: Banc;
const S = randomUUID();
const F = randomUUID(); // formateur de la leçon
const A = randomUUID(); // a une photo
const B = randomUUID(); // a une photo
const C = randomUUID(); // sans photo
let LECON: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const PHOTOS = new Map<string, string>();
const photo = (compte: string) => { if (!PHOTOS.has(compte)) PHOTOS.set(compte, `${compte}/${randomUUID()}.jpg`); return PHOTOS.get(compte)!; };

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie", "0036_formateur_sans_espace_etudiant", "0037_reponses_aux_reponses", "0038_photos_communaute",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [A, []], [B, []], [C, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const [id, prenom, nom] of [[A, "Aïcha", "Kpadé"], [B, "Taofick", "Mora"], [C, "Nadia", "Sossa"]]) {
    await banc.db.query("update public.profils set prenom = $2, nom = $3 where id = $1", [id, prenom, nom]);
  }
  for (const id of [A, B]) await banc.db.query("update public.profils set photo_url = $2 where id = $1", [id, photo(id)]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const f = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Canva', 'canva-0038', $1, true) returning id", [fiche])).id;
  const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module') returning id", [f])).id;
  LECON = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee) values ($1, 'Les calques', true) returning id", [m])).id;
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [f]);
});

type Carte = {
  auteur: { photo: string | null };
  aimee_par: { initiales: string; photo: string | null }[];
  dernieres_reponses: { auteur: { photo: string | null } }[];
};

describe("Les photos de la communauté", () => {
  it("l'auteur d'une publication, les derniers qui l'aiment et l'auteur d'un commentaire ont leur photo ; sinon null", async () => {
    const id = (await banc.en<{ id: string }>({ id: A }, "select (public.publier(null, '', 'Mon premier visuel', null) ->> 'id')::uuid as id"))[0].id;
    await banc.en({ id: B }, "select public.basculer_reaction($1)", [id]);
    await banc.en({ id: C }, "select public.basculer_reaction($1)", [id]);
    await banc.en({ id: B }, "select public.commenter($1, 'Superbe !', null)", [id]);
    const carte = (await banc.en<{ c: Carte }>({ id: C }, "select public.publication_communaute($1) as c", [id]))[0].c;
    expect(carte.auteur.photo).toBe(photo(A));
    expect(carte.aimee_par).toEqual([
      { initiales: "NS", photo: null },
      { initiales: "TM", photo: photo(B) },
    ]);
    expect(carte.dernieres_reponses[0].auteur.photo).toBe(photo(B));
  });

  it("l'auteur d'un commentaire dans les discussions d'une leçon a sa photo", async () => {
    const c = (await banc.en<{ c: { auteur: { photo: string | null } } }>({ id: A }, "select public.commenter_lecon($1, 'Merci !', null) as c", [LECON]))[0].c;
    expect(c.auteur.photo).toBe(photo(A));
  });
});
