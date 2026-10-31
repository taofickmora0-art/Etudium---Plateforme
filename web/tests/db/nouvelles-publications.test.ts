import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0042 (liste du 31 octobre 2026, tâche 9) : le bandeau « Nouvelles publications ». La base compte les
// publications parues dans le fil affiché depuis la plus récente qu'il montre (ou toutes, s'il est vide), et rend les
// trois derniers auteurs (initiales, photo). Pas les siennes, sauf une programmée qui vient de paraître.

let banc: Banc;
const S = randomUUID();
const A = randomUUID(); // Rodrigue Houngbo
const F = randomUUID(); // formateur du parcours P : Mireille Akpo
const E1 = randomUUID(); // suit P : Koffi Dossou (le compte qui lit)
const E2 = randomUUID(); // ne suit rien : Awa Kpadé
let P: string;

type Nouvelles = { nombre: number; auteurs: { initiales: string; photo: string | null }[] };
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const nouvelles = async (qui: string, espace: string, apres: string | null) =>
  (await banc.en<{ r: Nouvelles }>({ id: qui }, "select public.nouvelles_publications($1, $2::timestamptz) as r", [espace, apres]))[0].r;
/** Une publication : `il_y_a` en secondes (négatif : à venir) ; `ecrite` en secondes avant sa parution (programmée). */
const poster = async (qui: string, o: { il_y_a: number; parcours?: string | null; statut?: string; ecrite?: number }) =>
  (await un<{ id: string }>(
    `insert into public.publications (auteur, parcours_id, texte, statut, cree_le, ecrite_le)
     values ($1, $2, 'Bonjour', $3, now() - make_interval(secs => $4), now() - make_interval(secs => $4 + $5)) returning id`,
    [qui, o.parcours ?? null, o.statut ?? "publiee", o.il_y_a, o.ecrite ?? 0],
  )).id;
const ilYA = async (secondes: number) => (await un<{ t: string }>("select (now() - make_interval(secs => $1))::text as t", [secondes])).t;

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
      "0040_photos_colonne_communaute", "0041_notifications_communaute", "0042_nouvelles_publications",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [E1, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const [id, prenom, nom] of [[S, "Sena", "Agbo"], [A, "Rodrigue", "Houngbo"], [F, "Mireille", "Akpo"], [E1, "Koffi", "Dossou"], [E2, "Awa", "Kpadé"]]) {
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
  await banc.db.query("update public.profils set photo_url = null");
});

describe("Les nouvelles publications du fil", () => {
  it("celles des autres, parues après le repère ; ni les siennes, ni les programmées à venir, ni celles en attente", async () => {
    await poster(E2, { il_y_a: 600 }); // avant le repère
    await poster(E2, { il_y_a: 60 });
    await poster(A, { il_y_a: 30 });
    await poster(E2, { il_y_a: 20, statut: "en_attente" });
    await poster(E2, { il_y_a: -3600, ecrite: 60 }); // programmée, à venir
    await poster(E1, { il_y_a: 10 }); // la sienne
    const repere = await ilYA(300);
    expect(await nouvelles(E1, "tous", repere)).toEqual({ nombre: 2, auteurs: [{ initiales: "RH", photo: null }, { initiales: "AK", photo: null }] });
    expect((await nouvelles(E1, "general", repere)).nombre).toBe(2);
    expect(await nouvelles(E1, P, repere)).toEqual({ nombre: 0, auteurs: [] });
  });

  it("un parcours : compté pour qui le suit, jamais pour les autres ; un espace inconnu : rien", async () => {
    await poster(F, { il_y_a: 60, parcours: P });
    const repere = await ilYA(300);
    expect((await nouvelles(E1, "tous", repere)).nombre).toBe(1);
    expect((await nouvelles(E1, P, repere)).nombre).toBe(1);
    expect((await nouvelles(E1, "general", repere)).nombre).toBe(0);
    expect((await nouvelles(E2, "tous", repere)).nombre).toBe(0);
    expect((await nouvelles(E2, P, repere)).nombre).toBe(0);
    expect(await nouvelles(E1, "pas-un-espace", repere)).toEqual({ nombre: 0, auteurs: [] });
  });

  it("sans repère (fil vide) : toutes celles parues ; trois auteurs au plus, du plus récent au plus ancien, avec leur photo", async () => {
    const photo = `${E2}/${randomUUID()}.jpg`;
    await banc.db.query("update public.profils set photo_url = $2 where id = $1", [E2, photo]);
    await poster(S, { il_y_a: 400 });
    await poster(A, { il_y_a: 300 });
    await poster(E2, { il_y_a: 200 });
    await poster(F, { il_y_a: 100 });
    await poster(E2, { il_y_a: 50 });
    expect(await nouvelles(E1, "tous", null)).toEqual({
      nombre: 5,
      auteurs: [{ initiales: "AK", photo }, { initiales: "MA", photo: null }, { initiales: "RH", photo: null }],
    });
  });

  it("sa publication programmée qui vient de paraître compte : elle n'est pas encore dans son fil", async () => {
    await poster(E1, { il_y_a: 30, ecrite: 7200 });
    expect(await nouvelles(E1, "tous", await ilYA(300))).toEqual({ nombre: 1, auteurs: [{ initiales: "KD", photo: null }] });
  });
});
