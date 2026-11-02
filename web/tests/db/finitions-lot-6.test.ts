import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, creerParcours } from "./engagement-banc";

// Migration 0064 : les points mineurs reportés des lots 4, 5 et 6 A, côté base (journal, abonnements, désactivation,
// versions, enregistrement d'une leçon).

let banc: Banc;
const [S, A, E, M] = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const journal = async (action: string) =>
  (await banc.db.query<{ resume: string }>("select resume from public.journal_actions where action = $1 order by id", [action])).rows.map((r) => r.resume);
const versions = async (formation: string) => (await un<{ n: number }>("select count(*)::int as n from public.versions_formations where formation_id = $1", [formation])).n;
const donnees = (document: unknown) => ({
  titre: "Leçon",
  titre_court: null,
  resume: "Résumé",
  points_cles: [],
  video_fournisseur: null,
  video_id: null,
  duree_secondes: 60,
  document,
  texte: "Bonjour",
});
const video = (id: string) => ({ type: "doc", content: [{ type: "videoLecon", attrs: { fournisseur: "youtube", id } }] });

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0064"));
  await banc.creerCompte(S, ["super_admin"]);
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(M, ["admin"]);
  await banc.creerCompte(E);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [E]);
}, 60_000);

describe("Migration 0064 : le journal", () => {
  it("supprimer un parcours : une ligne pour le parcours, aucune « Publication supprimée » en cascade", async () => {
    const P = await creerParcours(banc, "Méthodologie");
    for (const texte of ["Un", "Deux", "Trois"]) {
      await banc.db.query("insert into public.publications (auteur, parcours_id, texte) values ($1, $2, $3)", [E, P, texte]);
    }
    await banc.en({ id: A }, "delete from public.parcours where id = $1", [P]);
    expect(await journal("contenu_supprime")).toEqual([]);
    expect(await journal("parcours_supprime")).toEqual(["Parcours « Méthodologie » supprimé"]);
  });

  it("résilier : une seule ligne, « résiliés », pas « annulé » pour chaque abonnement", async () => {
    await abonner(banc, E);
    await abonner(banc, E, { debut: "now() + interval '30 days'", fin: "now() + interval '60 days'" });
    await banc.en({ id: A }, "select public.resilier_abonnements($1, 'Demande de l’étudiante')", [E]);
    expect(await journal("abonnement_annule")).toEqual([]);
    expect(await journal("abonnements_resilies")).toEqual(["2 abonnements de Aïcha Kpadé résiliés"]);
  });

  it("un membre de l'équipe supprimé reste dans le filtre « Auteur », avec son nom de l'époque", async () => {
    await banc.db.query(
      "insert into public.journal_actions (auteur, auteur_nom, categorie, action, cible_type, cible_id, cible_libelle, resume) values ($1, 'Gildas Tossou', 'comptes', 'essai', 'compte', 'x', 'x', 'Action de Gildas')",
      [M],
    );
    await banc.db.query("delete from auth.users where id = $1", [M]);
    const auteurs = (await banc.en<{ a: { id: string; nom: string }[] }>({ id: S }, "select public.auteurs_journal() as a"))[0].a;
    expect(auteurs).toContainEqual({ id: M, nom: "Gildas Tossou" });
    const lu = (await banc.en<{ l: { lignes: { resume: string }[] } }>({ id: S }, "select public.lire_journal(null, $1, null, null, 50) as l", [M]))[0].l;
    expect(lu.lignes.map((l) => l.resume)).toEqual(["Action de Gildas"]);
  });

  it("la vue d'ensemble a ses index (abonnements et profils par date, paiements par statut)", async () => {
    const index = (await banc.db.query<{ d: string }>("select indexdef as d from pg_indexes where tablename in ('abonnements', 'profils', 'paiements')")).rows.map((r) => r.d);
    expect(index.some((d) => /abonnements .*\(cree_le\)/.test(d))).toBe(true);
    expect(index.some((d) => /profils .*\(cree_le\)/.test(d))).toBe(true);
    expect(index.some((d) => /paiements .*\(statut, confirme_le\)/.test(d))).toBe(true);
  });
});

describe("Migration 0064 : la désactivation et les versions", () => {
  it("une formation ne se crée pas « désactivée » ; créée « publiée », elle a sa version « Mise en ligne »", async () => {
    await expect(
      banc.en({ id: A }, "insert into public.formations (titre, slug, statut) values ('Directe', $1, 'desactivee')", [randomUUID()]),
    ).rejects.toThrow("Seule une formation publiée peut être désactivée.");
    const id = (await banc.en<{ id: string }>({ id: A }, "insert into public.formations (titre, slug, statut) values ('Publiée', $1, 'publiee') returning id", [randomUUID()]))[0].id;
    expect((await banc.db.query("select resume from public.versions_formations where formation_id = $1", [id])).rows).toEqual([{ resume: "Mise en ligne" }]);
  });

  it("une version identique à la précédente n'est pas recréée (archivée puis remise en ligne)", async () => {
    const f = await creerFormation(banc, "Excel", { quiz: false, exercice: null });
    const avant = await versions(f.id);
    expect(avant).toBeGreaterThan(0);
    await banc.en({ id: A }, "update public.formations set statut = 'archivee' where id = $1", [f.id]);
    await banc.en({ id: A }, "update public.formations set statut = 'publiee' where id = $1", [f.id]);
    expect(await versions(f.id)).toBe(avant);
  });

  it("publier des brouillons identiques à ce qui est en ligne : pas de « version N » déjà existante annoncée", async () => {
    const f = await creerFormation(banc, "Zotero", { quiz: false, exercice: null });
    await banc.db.query(
      "insert into public.brouillons_lecons (lecon_id, donnees, revision, modifie_par) select l.id, public.donnees_lecon(l.id), 1, $2 from public.lecons l where l.id = $1",
      [f.lecons[0], A],
    );
    const r = (await banc.en<{ r: { publiees: number; version: number | null } }>({ id: A }, "select public.publier_modifications($1) as r", [f.id]))[0].r;
    expect(r).toEqual({ publiees: 1, version: null });
  });

  it("« En ligne » : faux pour toutes les versions d'une formation repassée en brouillon", async () => {
    const f = await creerFormation(banc, "Word", { quiz: false, exercice: null });
    const enLigne = async () => (await banc.en<{ v: { en_ligne: boolean }[] }>({ id: A }, "select public.versions_formation($1) as v", [f.id]))[0].v.map((v) => v.en_ligne);
    expect(await enLigne()).toContain(true);
    await banc.db.query("update public.formations set statut = 'brouillon' where id = $1", [f.id]);
    expect(await enLigne()).not.toContain(true);
  });
});

describe("Migration 0064 : l'enregistrement d'une leçon", () => {
  it("une vidéo intégrée au contenu garde l'identifiant de sa plateforme (comme la vidéo de la leçon)", async () => {
    const f = await creerFormation(banc, "Canva", { quiz: false, exercice: null, statut: "brouillon" });
    const enregistrer = (document: unknown) =>
      banc.en({ id: A }, "select public.enregistrer_lecon($1, $2::jsonb, 0)", [f.lecons[0], JSON.stringify(donnees(document))]);
    await expect(enregistrer(video("../../embed?x=1"))).rejects.toThrow("Une vidéo du contenu n’a pas un identifiant valide");
    await expect(enregistrer(video("dQw4w9WgXcQ"))).resolves.toBeDefined();
  });
});
