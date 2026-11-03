import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";
import { creerFormation } from "./engagement-banc";

// Migration 0074 : la Bibliothèque numérique (spec du 3 novembre 2026, étape A ; base complète pour les étapes B et C).
//   - livres, catégories, parcours d'un livre, livres recommandés par une formation, lectures, favoris, téléchargements ;
//   - acces_livre : l'équipe des contenus ; sinon un compte actif, un livre publié, gratuit ou abonnement en cours ;
//   - les fiches publiques passent par des fonctions (catalogue, fiche, « Continuer la lecture ») : jamais le chemin du PDF ;
//   - l'espace privé « bibliotheque » (PDF, 50 Mo) se lit avec acces_livre ; l'équipe seule y dépose ;
//   - les couvertures vont dans l'espace public « couvertures », sous livres/<id>/.

const MIGRATION = "supabase/migrations/0074_bibliotheque.sql";
const REFUS = /row-level security|permission denied/;

let banc: Banc;
// A : admin (équipe des contenus) ; M : modérateur (communauté seulement) ; E : étudiante sans abonnement ;
// B : étudiant abonné ; S : abonnée suspendue ; F : formateur.
const [A, M, E, B, S, F] = Array.from({ length: 6 }, () => randomUUID());

type Livre = { id: string; slug: string; titre: string; fichier: string };
type Carte = {
  id: string;
  slug: string;
  titre: string;
  auteur: string;
  acces: string;
  acces_etat: string;
  ouvert: boolean;
  favori: boolean;
  telechargeable: boolean;
  nb_pages: number | null;
  categorie: { id: string; slug: string; nom: string } | null;
  parcours: { slug: string; nom: string; couleur: string }[];
  lecture: { derniere_page: number; nb_pages: number; pourcentage: number; terminee: boolean } | null;
};
type Catalogue = { livres: Carte[]; categories: { slug: string; nom: string; livres: number }[]; parcours: { slug: string; livres: number }[] };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const qui = (id: string): Qui => ({ id });

/** Un livre posé en superutilisateur : un PDF dans son dossier, la case des droits cochée, puis l'état voulu. */
async function poserLivre(
  titre: string,
  o: {
    acces?: "gratuit" | "abonnes";
    telechargeable?: boolean;
    statut?: "brouillon" | "publie" | "archive";
    auteur?: string;
    motsCles?: string[];
    categorie?: string | null;
    parcours?: string[];
  } = {},
): Promise<Livre> {
  const id = randomUUID();
  const slug = `l-${id.slice(0, 8)}`;
  const fichier = `${id}/${randomUUID()}.pdf`;
  await banc.db.query(
    `insert into public.livres (id, slug, titre, auteur, mots_cles, acces, telechargeable, fichier, taille_octets, nb_pages, droits_confirmes, categorie_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 1200000, 120, true, $9)`,
    [id, slug, titre, o.auteur ?? "Awa Kpadé", o.motsCles ?? [], o.acces ?? "abonnes", o.telechargeable ?? false, fichier, o.categorie ?? null],
  );
  for (const p of o.parcours ?? []) await banc.db.query("insert into public.livres_parcours (livre_id, parcours_id) values ($1, $2)", [id, p]);
  await banc.db.query("insert into storage.objects (bucket_id, name) values ('bibliotheque', $1)", [fichier]);
  if ((o.statut ?? "publie") !== "brouillon") await banc.db.query("update public.livres set statut = 'publie' where id = $1", [id]);
  if (o.statut === "archive") await banc.db.query("update public.livres set statut = 'archive' where id = $1", [id]);
  return { id, slug, titre, fichier };
}

let parcoursAcademique: string;
let parcoursDigital: string;
let methodes: string;
let gratuit: Livre;
let reserve: Livre;
let brouillon: Livre;
let archive: Livre;
let telechargeable: Livre;

const catalogue = (q: Qui, args: { recherche?: string; parcours?: string | null; categorie?: string | null; gratuits?: boolean } = {}) =>
  rpc<Catalogue>(q, "select public.bibliotheque_catalogue($1, $2, $3, $4) as r", [
    args.recherche ?? "",
    args.parcours ?? null,
    args.categorie ?? null,
    args.gratuits ?? false,
  ]);
const carte = async (q: Qui, livre: Livre) => (await catalogue(q)).livres.find((l) => l.id === livre.id);
const acces = (q: Qui, livre: Livre) => rpc<boolean>(q, "select public.acces_livre($1) as r", [livre.id]);
const noter = (q: Qui, livre: Livre, page: number, total: number) =>
  rpc<{ derniere_page: number; nb_pages: number; pourcentage: number; terminee: boolean }>(q, "select public.noter_lecture($1, $2, $3) as r", [
    livre.id,
    page,
    total,
  ]);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0073"));
  for (const [id, roles] of [
    [A, ["admin"]],
    [M, ["moderateur"]],
    [E, []],
    [B, []],
    [S, []],
    [F, ["formateur"]],
  ] as const)
    await banc.creerCompte(id, [...roles]);
  await abonner(banc, B);
  await abonner(banc, S);
  await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [S]);
  await banc.appliquer(MIGRATION);

  const parcours = async (slug: string) => (await un<{ id: string }>("select id from public.parcours where slug = $1", [slug])).id;
  parcoursAcademique = await parcours("reussite-academique");
  parcoursDigital = await parcours("competences-digitales");
  methodes = (await un<{ id: string }>("insert into public.categories_livres (nom, slug, ordre) values ('Méthodes de travail', 'methodes', 1) returning id"))
    .id;
  await banc.db.query("insert into public.categories_livres (nom, slug, ordre) values ('Modèles de mémoire', 'modeles', 2)");

  gratuit = await poserLivre("Réussir son mémoire", {
    acces: "gratuit",
    auteur: "Dr Mireille Adjovi",
    motsCles: ["méthodologie", "rédaction"],
    categorie: methodes,
    parcours: [parcoursAcademique],
  });
  reserve = await poserLivre("Excel pour les étudiants", { parcours: [parcoursDigital] });
  brouillon = await poserLivre("Le livre pas encore prêt", { statut: "brouillon" });
  archive = await poserLivre("Ancienne édition", { statut: "archive" });
  telechargeable = await poserLivre("Modèle de CV", { telechargeable: true, categorie: methodes });
});

// La limite de débit des lectures (60 par minute) ne doit pas gêner les tests qui ne la visent pas.
beforeEach(async () => {
  await banc.db.query("delete from public.debit_lectures");
});

describe("Les livres : création, publication, suppression", () => {
  it("l'équipe crée un livre : brouillon, inclus dans l'abonnement, non téléchargeable, en français, droits non cochés", async () => {
    const slug = `nouveau-${randomUUID().slice(0, 8)}`;
    const [l] = await banc.en<Record<string, unknown>>(
      qui(A),
      "insert into public.livres (titre, slug) values ('Guide du stage', $1) returning statut, acces, telechargeable, langue, droits_confirmes, cree_par, publie_le, mots_cles",
      [slug],
    );
    expect(l).toEqual({
      statut: "brouillon",
      acces: "abonnes",
      telechargeable: false,
      langue: "fr",
      droits_confirmes: false,
      cree_par: A,
      publie_le: null,
      mots_cles: [],
    });
  });

  it("un modérateur, une étudiante, un formateur et un visiteur ne créent ni ne modifient de livre", async () => {
    for (const q of [qui(M), qui(E), qui(F), "anon" as const]) {
      await expect(banc.en(q, "insert into public.livres (titre, slug) values ('Pirate', $1)", [`p-${randomUUID().slice(0, 8)}`])).rejects.toThrow(REFUS);
    }
    for (const q of [qui(M), qui(E), qui(F)])
      expect(await banc.en(q, "update public.livres set titre = 'Pirate' where id = $1 returning id", [gratuit.id])).toEqual([]);
    await expect(banc.en("anon", "update public.livres set titre = 'Pirate' where id = $1", [gratuit.id])).rejects.toThrow(REFUS);
  });

  it("publier exige le PDF, puis la case « J'ai le droit de diffuser ce livre »", async () => {
    const id = randomUUID();
    await banc.en(qui(A), "insert into public.livres (id, titre, slug) values ($1, 'Sans fichier', $2)", [id, `s-${id.slice(0, 8)}`]);
    await expect(banc.en(qui(A), "update public.livres set statut = 'publie' where id = $1", [id])).rejects.toThrow(
      "Déposez le PDF du livre avant de le publier.",
    );
    await banc.en(qui(A), "update public.livres set fichier = $2, taille_octets = 2000 where id = $1", [id, `${id}/${randomUUID()}.pdf`]);
    await expect(banc.en(qui(A), "update public.livres set statut = 'publie' where id = $1", [id])).rejects.toThrow(
      "Cochez « J’ai le droit de diffuser ce livre » avant de le publier.",
    );
    await banc.en(qui(A), "update public.livres set droits_confirmes = true where id = $1", [id]);
    const [publie] = await banc.en<{ statut: string; publie_le: string | null }>(
      qui(A),
      "update public.livres set statut = 'publie' where id = $1 returning statut, publie_le",
      [id],
    );
    expect(publie.statut).toBe("publie");
    expect(publie.publie_le).not.toBeNull();
    // Publié, il garde sa case cochée et son fichier.
    await expect(banc.en(qui(A), "update public.livres set droits_confirmes = false where id = $1", [id])).rejects.toThrow(
      "Un livre publié garde la case « J’ai le droit de diffuser ce livre » cochée.",
    );
    await expect(banc.en(qui(A), "update public.livres set fichier = null where id = $1", [id])).rejects.toThrow("Un livre publié garde son PDF.");
  });

  it("un livre publié garde son adresse, ne redevient pas brouillon, s'archive et se republie", async () => {
    const l = await poserLivre("Adresse figée");
    await expect(banc.en(qui(A), "update public.livres set slug = 'autre-adresse' where id = $1", [l.id])).rejects.toThrow(
      "L’adresse d’un livre publié ne change plus.",
    );
    await expect(banc.en(qui(A), "update public.livres set statut = 'brouillon' where id = $1", [l.id])).rejects.toThrow(
      "Un livre publié ne redevient pas un brouillon : archivez-le.",
    );
    const premier = (await un<{ publie_le: string }>("select publie_le from public.livres where id = $1", [l.id])).publie_le;
    await banc.en(qui(A), "update public.livres set statut = 'archive' where id = $1", [l.id]);
    await banc.en(qui(A), "update public.livres set statut = 'publie' where id = $1", [l.id]);
    expect((await un<{ publie_le: string }>("select publie_le from public.livres where id = $1", [l.id])).publie_le).toEqual(premier);
  });

  it("seul un livre publié s'archive", async () => {
    await expect(banc.en(qui(A), "update public.livres set statut = 'archive' where id = $1", [brouillon.id])).rejects.toThrow(
      "Seul un livre publié s’archive.",
    );
  });

  it("on ne supprime qu'un brouillon jamais publié", async () => {
    const publie = await poserLivre("Publié");
    const archiveTest = await poserLivre("Archivé", { statut: "archive" });
    const brouillonTest = await poserLivre("Brouillon", { statut: "brouillon" });
    await expect(banc.en(qui(A), "delete from public.livres where id = $1", [publie.id])).rejects.toThrow("Un livre publié s’archive, il ne se supprime pas.");
    await expect(banc.en(qui(A), "delete from public.livres where id = $1", [archiveTest.id])).rejects.toThrow(
      "Un livre publié s’archive, il ne se supprime pas.",
    );
    expect(await banc.en(qui(E), "delete from public.livres where id = $1 returning id", [brouillonTest.id])).toEqual([]);
    expect(await banc.en(qui(A), "delete from public.livres where id = $1 returning id", [brouillonTest.id])).toEqual([{ id: brouillonTest.id }]);
  });

  it("le PDF et la couverture restent dans le dossier du livre ; 50 Mo au plus ; un PDF seulement", async () => {
    const id = brouillon.id;
    const refuse = (colonnes: string, valeur: unknown) => banc.db.query(`update public.livres set ${colonnes} = $2 where id = $1`, [id, valeur]);
    await expect(refuse("fichier", `${gratuit.id}/${randomUUID()}.pdf`)).rejects.toThrow(/livres_fichier_chemin/);
    await expect(refuse("fichier", `${id}/${randomUUID()}.docx`)).rejects.toThrow(/livres_fichier_chemin/);
    await expect(refuse("couverture", `${id}/${randomUUID()}.jpg`)).rejects.toThrow(/livres_couverture_chemin/);
    await expect(refuse("couverture", `livres/${id}/${randomUUID()}.gif`)).rejects.toThrow(/livres_couverture_chemin/);
    await expect(refuse("taille_octets", 52428801)).rejects.toThrow(/livres_taille/);
    await refuse("couverture", `livres/${id}/${randomUUID()}.webp`);
    await refuse("couverture", null);
  });

  it("les catégories : tout le monde les lit, l'équipe seule les écrit ; supprimer une catégorie laisse ses livres sans catégorie", async () => {
    expect((await banc.en<{ slug: string }>("anon", "select slug from public.categories_livres order by ordre")).map((c) => c.slug)).toEqual([
      "methodes",
      "modeles",
    ]);
    await expect(banc.en(qui(E), "insert into public.categories_livres (nom, slug) values ('Pirate', 'pirate')")).rejects.toThrow(REFUS);
    const [c] = await banc.en<{ id: string }>(
      qui(A),
      "insert into public.categories_livres (nom, slug, ordre) values ('Temporaire', 'temporaire', 9) returning id",
    );
    const l = await poserLivre("Dans une catégorie temporaire", { categorie: c.id, statut: "brouillon" });
    await banc.en(qui(A), "delete from public.categories_livres where id = $1", [c.id]);
    expect((await un<{ categorie_id: string | null }>("select categorie_id from public.livres where id = $1", [l.id])).categorie_id).toBeNull();
  });

  it("ranger_categorie_livre : l'équipe range une catégorie ; les autres sont refusés", async () => {
    const modeles = (await un<{ id: string }>("select id from public.categories_livres where slug = 'modeles'")).id;
    await banc.en(qui(A), "select public.ranger_categorie_livre($1, 1)", [modeles]);
    expect((await banc.en<{ slug: string }>("anon", "select slug from public.categories_livres order by ordre, nom")).map((c) => c.slug)).toEqual([
      "modeles",
      "methodes",
    ]);
    await expect(banc.en(qui(M), "select public.ranger_categorie_livre($1, 2)", [modeles])).rejects.toThrow(/Réservé|permission denied/);
    await banc.en(qui(A), "select public.ranger_categorie_livre($1, 2)", [modeles]);
    expect((await banc.en<{ slug: string }>("anon", "select slug from public.categories_livres order by ordre, nom")).map((c) => c.slug)).toEqual([
      "methodes",
      "modeles",
    ]);
  });
});

describe("acces_livre", () => {
  it("un visiteur : aucun livre (il lit après connexion)", async () => {
    for (const l of [gratuit, reserve, brouillon, archive]) expect(await acces("anon", l)).toBe(false);
  });

  it("un compte sans abonnement : les livres gratuits publiés ; un abonné : tous les livres publiés", async () => {
    expect([await acces(qui(E), gratuit), await acces(qui(E), reserve), await acces(qui(E), brouillon), await acces(qui(E), archive)]).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect([await acces(qui(B), gratuit), await acces(qui(B), reserve), await acces(qui(B), brouillon), await acces(qui(B), archive)]).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  it("un compte suspendu : rien, même abonné", async () => {
    for (const l of [gratuit, reserve]) expect(await acces(qui(S), l)).toBe(false);
  });

  it("l'équipe des contenus : tout, brouillons et archives compris ; un modérateur suit la règle des étudiants", async () => {
    for (const l of [gratuit, reserve, brouillon, archive]) expect(await acces(qui(A), l)).toBe(true);
    expect([await acces(qui(M), gratuit), await acces(qui(M), reserve)]).toEqual([true, false]);
  });

  it("un livre qui n'existe pas : non", async () => {
    expect(await rpc<boolean>(qui(A), "select public.acces_livre($1) as r", [randomUUID()])).toBe(false);
  });
});

describe("Les fiches publiques (catalogue, fiche d'un livre)", () => {
  it("la table des livres n'est lue que par l'équipe : le chemin d'un PDF n'est jamais lisible ailleurs", async () => {
    for (const q of ["anon" as const, qui(E), qui(B)]) expect(await banc.en(q, "select fichier from public.livres")).toEqual([]);
    expect((await banc.en(qui(A), "select fichier from public.livres where id = $1", [gratuit.id]))[0]).toEqual({ fichier: gratuit.fichier });
  });

  it("le catalogue : les livres publiés seulement, sans chemin de fichier, avec catégorie, parcours et accès", async () => {
    const vu = await catalogue("anon");
    const ids = vu.livres.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining([gratuit.id, reserve.id, telechargeable.id]));
    expect(ids).not.toContain(brouillon.id);
    expect(ids).not.toContain(archive.id);
    expect(JSON.stringify(vu)).not.toContain(".pdf");
    expect(vu.livres.some((l) => "fichier" in l)).toBe(false);
    const g = vu.livres.find((l) => l.id === gratuit.id);
    expect(g).toMatchObject({
      slug: gratuit.slug,
      titre: "Réussir son mémoire",
      auteur: "Dr Mireille Adjovi",
      acces: "gratuit",
      acces_etat: "connexion",
      ouvert: false,
      favori: false,
      nb_pages: 120,
      lecture: null,
      categorie: { id: methodes, slug: "methodes", nom: "Méthodes de travail" },
      parcours: [{ slug: "reussite-academique", couleur: "academique" }],
    });
    expect(vu.categories.find((c) => c.slug === "methodes")).toMatchObject({ nom: "Méthodes de travail", livres: 2 });
    expect(vu.parcours.find((p) => p.slug === "competences-digitales")).toMatchObject({ livres: 1 });
  });

  it("l'état d'accès selon le compte : ouvert, connexion, abonnement", async () => {
    expect(await carte(qui(E), gratuit)).toMatchObject({ ouvert: true, acces_etat: "ouvert" });
    expect(await carte(qui(E), reserve)).toMatchObject({ ouvert: false, acces_etat: "abonnement" });
    expect(await carte(qui(B), reserve)).toMatchObject({ ouvert: true, acces_etat: "ouvert" });
    expect(await carte(qui(S), gratuit)).toMatchObject({ ouvert: false, acces_etat: "ferme" });
  });

  it("les filtres : recherche (titre, auteur, mots-clés, sans accents), parcours, catégorie, gratuits", async () => {
    const titres = async (args: Parameters<typeof catalogue>[1]) => (await catalogue("anon", args)).livres.map((l) => l.titre).sort();
    expect(await titres({ recherche: "memoire" })).toEqual(["Réussir son mémoire"]);
    expect(await titres({ recherche: "ADJOVI" })).toEqual(["Réussir son mémoire"]);
    expect(await titres({ recherche: "methodologie" })).toEqual(["Réussir son mémoire"]);
    expect(await titres({ parcours: "competences-digitales" })).toEqual(["Excel pour les étudiants"]);
    expect(await titres({ categorie: "methodes" })).toEqual(["Modèle de CV", "Réussir son mémoire"]);
    expect(await titres({ gratuits: true })).toEqual(["Réussir son mémoire"]);
  });

  it("la fiche d'un livre publié, pour tous ; un brouillon n'existe que pour l'équipe", async () => {
    const fiche = await rpc<Record<string, unknown> | null>("anon", "select public.livre_fiche($1) as r", [gratuit.slug]);
    expect(fiche).toMatchObject({ id: gratuit.id, titre: "Réussir son mémoire", taille_octets: 1200000, langue: "fr", formations: [] });
    expect(JSON.stringify(fiche)).not.toContain(".pdf");
    expect(await rpc("anon", "select public.livre_fiche($1) as r", [brouillon.slug])).toBeNull();
    expect(await rpc(qui(E), "select public.livre_fiche($1) as r", [archive.slug])).toBeNull();
    expect(await rpc(qui(A), "select public.livre_fiche($1) as r", [brouillon.slug])).toMatchObject({ id: brouillon.id, statut: "brouillon" });
    expect(await rpc("anon", "select public.livre_fiche('pas-un-livre') as r")).toBeNull();
  });
});

describe("noter_lecture", () => {
  it("refusée à un visiteur et sans accès au livre", async () => {
    await expect(noter("anon", gratuit, 1, 10)).rejects.toThrow(REFUS);
    await expect(noter(qui(E), reserve, 1, 10)).rejects.toThrow("Ce livre ne vous est pas ouvert.");
    await expect(noter(qui(S), gratuit, 1, 10)).rejects.toThrow("Ce livre ne vous est pas ouvert.");
    await expect(noter(qui(E), brouillon, 1, 10)).rejects.toThrow("Ce livre ne vous est pas ouvert.");
  });

  it("garde la dernière page ; terminé à la dernière page, et le reste en revenant en arrière", async () => {
    expect(await noter(qui(E), gratuit, 3, 10)).toEqual({ derniere_page: 3, nb_pages: 10, pourcentage: 30, terminee: false });
    expect(await noter(qui(E), gratuit, 10, 10)).toEqual({ derniere_page: 10, nb_pages: 10, pourcentage: 100, terminee: true });
    expect(await noter(qui(E), gratuit, 2, 10)).toEqual({ derniere_page: 2, nb_pages: 10, pourcentage: 100, terminee: true });
  });

  it("une page hors du livre est ramenée dans le livre ; un total absurde est refusé", async () => {
    expect(await noter(qui(B), telechargeable, 40, 12)).toMatchObject({ derniere_page: 12, terminee: true });
    expect(await noter(qui(B), reserve, 0, 12)).toMatchObject({ derniere_page: 1, terminee: false });
    await expect(noter(qui(B), reserve, 1, 0)).rejects.toThrow("Nombre de pages invalide.");
  });

  it("chacun ne lit que ses propres lectures, et personne ne les écrit directement", async () => {
    expect(await banc.en(qui(B), "select livre_id from public.lectures_livres where profil_id = $1", [E])).toEqual([]);
    expect((await banc.en<{ livre_id: string }>(qui(E), "select livre_id from public.lectures_livres")).map((l) => l.livre_id)).toEqual([gratuit.id]);
    await expect(banc.en(qui(E), "insert into public.lectures_livres (profil_id, livre_id) values ($1, $2)", [E, telechargeable.id])).rejects.toThrow(REFUS);
    await expect(banc.en(qui(E), "update public.lectures_livres set derniere_page = 99")).rejects.toThrow(REFUS);
  });

  it("une limite de débit : 60 mises à jour par minute et par compte", async () => {
    for (let i = 1; i <= 60; i++) await noter(qui(B), reserve, (i % 11) + 1, 12);
    await expect(noter(qui(B), reserve, 5, 12)).rejects.toThrow("Trop de mises à jour de lecture en peu de temps : réessayez dans un instant.");
    await banc.db.query("update public.debit_lectures set fenetre_le = now() - interval '2 minutes'");
    expect(await noter(qui(B), reserve, 5, 12)).toMatchObject({ derniere_page: 5 });
  });

  it("« Continuer la lecture » : les livres commencés, non terminés, du plus récent au plus ancien", async () => {
    const lus = await rpc<Carte[]>(qui(B), "select public.mes_lectures() as r");
    expect(lus.map((l) => l.id)).toEqual([reserve.id]);
    expect(lus[0].lecture).toMatchObject({ derniere_page: 5, nb_pages: 12 });
    expect(await rpc<Carte[]>(qui(E), "select public.mes_lectures() as r")).toEqual([]);
    expect(await rpc<Carte[]>("anon", "select public.mes_lectures() as r")).toEqual([]);
    expect((await carte(qui(B), reserve))?.lecture).toMatchObject({ derniere_page: 5, pourcentage: expect.any(Number), terminee: false });
  });
});

describe("chemin_livre (le lien signé du lecteur et du téléchargement)", () => {
  it("le chemin du PDF, seulement avec l'accès au livre", async () => {
    expect(await rpc<string>(qui(E), "select public.chemin_livre($1) as r", [gratuit.id])).toBe(gratuit.fichier);
    expect(await rpc<string>(qui(B), "select public.chemin_livre($1) as r", [reserve.id])).toBe(reserve.fichier);
    expect(await rpc<string>(qui(A), "select public.chemin_livre($1) as r", [brouillon.id])).toBe(brouillon.fichier);
    await expect(banc.en(qui(E), "select public.chemin_livre($1)", [reserve.id])).rejects.toThrow("Ce livre ne vous est pas ouvert.");
    await expect(banc.en(qui(S), "select public.chemin_livre($1)", [gratuit.id])).rejects.toThrow("Ce livre ne vous est pas ouvert.");
    await expect(banc.en("anon", "select public.chemin_livre($1)", [gratuit.id])).rejects.toThrow(REFUS);
  });
});

describe("noter_telechargement", () => {
  it("refusé pour un livre non téléchargeable, même avec l'accès", async () => {
    await expect(banc.en(qui(B), "select public.noter_telechargement($1)", [reserve.id])).rejects.toThrow("Ce livre se lit dans le site, sans téléchargement.");
  });

  it("refusé sans accès au livre (compte sans abonnement, visiteur)", async () => {
    await expect(banc.en(qui(E), "select public.noter_telechargement($1)", [telechargeable.id])).rejects.toThrow("Ce livre ne vous est pas ouvert.");
    await expect(banc.en("anon", "select public.noter_telechargement($1)", [telechargeable.id])).rejects.toThrow(REFUS);
  });

  it("accepté pour un abonné : un téléchargement de plus ; la table ne se lit pas directement", async () => {
    await banc.en(qui(B), "select public.noter_telechargement($1)", [telechargeable.id]);
    expect(
      (await un<{ n: number }>("select count(*)::int as n from public.telechargements_livres where livre_id = $1 and profil_id = $2", [telechargeable.id, B]))
        .n,
    ).toBe(1);
    await expect(banc.en(qui(B), "select * from public.telechargements_livres")).rejects.toThrow(REFUS);
  });

  it("une limite de débit : 20 téléchargements par 10 minutes et par compte", async () => {
    for (let i = 0; i < 19; i++) await banc.en(qui(B), "select public.noter_telechargement($1)", [telechargeable.id]);
    await expect(banc.en(qui(B), "select public.noter_telechargement($1)", [telechargeable.id])).rejects.toThrow(
      "Trop de téléchargements en peu de temps : réessayez dans quelques minutes.",
    );
    await banc.db.query("delete from public.telechargements_livres where profil_id = $1", [B]);
  });
});

describe("L'espace de fichiers privé « bibliotheque »", () => {
  const voir = (q: Qui, nom: string) => banc.en<{ name: string }>(q, "select name from storage.objects where bucket_id = 'bibliotheque' and name = $1", [nom]);

  it("privé, 50 Mo, PDF seulement", async () => {
    const espace = await un<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'bibliotheque'",
    );
    expect({ ...espace, file_size_limit: Number(espace.file_size_limit) }).toEqual({
      public: false,
      file_size_limit: 52428800,
      allowed_mime_types: ["application/pdf"],
    });
  });

  it("l'équipe des contenus dépose un PDF dans le dossier d'un livre ; les autres sont refusés", async () => {
    const nom = `${brouillon.id}/${randomUUID()}.pdf`;
    expect(await banc.en(qui(A), "insert into storage.objects (bucket_id, name) values ('bibliotheque', $1) returning name", [nom])).toEqual([{ name: nom }]);
    for (const q of ["anon" as const, qui(E), qui(M), qui(F)]) {
      await expect(
        banc.en(q, "insert into storage.objects (bucket_id, name) values ('bibliotheque', $1)", [`${brouillon.id}/${randomUUID()}.pdf`]),
      ).rejects.toThrow(REFUS);
    }
    await expect(
      banc.en(qui(A), "insert into storage.objects (bucket_id, name) values ('bibliotheque', $1)", [`ailleurs/${randomUUID()}.pdf`]),
    ).rejects.toThrow(REFUS);
    await expect(
      banc.en(qui(A), "insert into storage.objects (bucket_id, name) values ('bibliotheque', $1)", [`${brouillon.id}/${randomUUID()}.exe`]),
    ).rejects.toThrow(REFUS);
  });

  it("la lecture suit acces_livre : visiteur, compte gratuit, abonné, suspendu, équipe", async () => {
    expect(await voir("anon", gratuit.fichier)).toEqual([]);
    expect(await voir(qui(E), gratuit.fichier)).toEqual([{ name: gratuit.fichier }]);
    expect(await voir(qui(E), reserve.fichier)).toEqual([]);
    expect(await voir(qui(B), reserve.fichier)).toEqual([{ name: reserve.fichier }]);
    expect(await voir(qui(B), brouillon.fichier)).toEqual([]);
    expect(await voir(qui(S), gratuit.fichier)).toEqual([]);
    expect(await voir(qui(A), brouillon.fichier)).toEqual([{ name: brouillon.fichier }]);
  });

  it("seule l'équipe supprime un fichier", async () => {
    const nom = `${brouillon.id}/${randomUUID()}.pdf`;
    await banc.db.query("insert into storage.objects (bucket_id, name) values ('bibliotheque', $1)", [nom]);
    expect(await banc.en(qui(B), "delete from storage.objects where bucket_id = 'bibliotheque' and name = $1 returning name", [nom])).toEqual([]);
    expect(await banc.en(qui(A), "delete from storage.objects where bucket_id = 'bibliotheque' and name = $1 returning name", [nom])).toEqual([{ name: nom }]);
  });

  it("les couvertures : dans l'espace public « couvertures », sous livres/<id>/, déposées par l'équipe seule", async () => {
    const nom = `livres/${brouillon.id}/${randomUUID()}.jpg`;
    expect(await banc.en(qui(A), "insert into storage.objects (bucket_id, name) values ('couvertures', $1) returning name", [nom])).toEqual([{ name: nom }]);
    await expect(
      banc.en(qui(E), "insert into storage.objects (bucket_id, name) values ('couvertures', $1)", [`livres/${brouillon.id}/${randomUUID()}.jpg`]),
    ).rejects.toThrow(REFUS);
    await expect(
      banc.en(qui(A), "insert into storage.objects (bucket_id, name) values ('couvertures', $1)", [`livres/pas-un-id/${randomUUID()}.jpg`]),
    ).rejects.toThrow(REFUS);
    expect(
      await banc.en(qui(A), "update storage.objects set metadata = '{}'::jsonb where bucket_id = 'couvertures' and name = $1 returning name", [nom]),
    ).toEqual([{ name: nom }]);
  });
});

describe("livres_back_office", () => {
  type BackOffice = {
    totaux: { publies: number; brouillons: number; archives: number; lectures: number; telechargements: number };
    livres: {
      id: string;
      fichier: string | null;
      droits_confirmes: boolean;
      statut: string;
      lectures: number;
      telechargements: number;
      parcours: { id: string }[];
      categorie: { id: string } | null;
      formations: number;
    }[];
  };

  it("réservée à l'équipe des contenus", async () => {
    for (const q of [qui(M), qui(E), qui(F)]) await expect(banc.en(q, "select public.livres_back_office()")).rejects.toThrow(/Réservé/);
    await expect(banc.en("anon", "select public.livres_back_office()")).rejects.toThrow(REFUS);
  });

  it("chaque livre avec son fichier, ses lectures et ses téléchargements (sans l'équipe) ; les totaux", async () => {
    await noter(qui(A), gratuit, 1, 10);
    await banc.en(qui(B), "select public.noter_telechargement($1)", [telechargeable.id]);
    await banc.en(qui(A), "select public.noter_telechargement($1)", [telechargeable.id]);
    const bo = await rpc<BackOffice>(qui(A), "select public.livres_back_office() as r");
    const g = bo.livres.find((l) => l.id === gratuit.id);
    expect(g).toMatchObject({
      fichier: gratuit.fichier,
      droits_confirmes: true,
      statut: "publie",
      lectures: 1,
      telechargements: 0,
      categorie: { id: methodes },
    });
    expect(g?.parcours.map((p) => p.id)).toEqual([parcoursAcademique]);
    expect(bo.livres.find((l) => l.id === telechargeable.id)).toMatchObject({ telechargements: 1 });
    const { rows } = await banc.db.query<{ statut: string; n: number }>("select statut, count(*)::int as n from public.livres group by statut");
    const n = (statut: string) => rows.find((r) => r.statut === statut)?.n ?? 0;
    expect(bo.totaux).toMatchObject({ publies: n("publie"), brouillons: n("brouillon"), archives: n("archive") });
    // E a lu « Réussir son mémoire », B « Excel » et « Modèle de CV » : l'équipe ne compte pas.
    expect(bo.totaux.lectures).toBe(3);
    expect(bo.totaux.telechargements).toBe(1);
  });

  it("un seul livre, avec son identifiant", async () => {
    const bo = await rpc<BackOffice>(qui(A), "select public.livres_back_office($1) as r", [reserve.id]);
    expect(bo.livres.map((l) => l.id)).toEqual([reserve.id]);
  });
});

describe("Les livres recommandés par une formation", () => {
  let formation: string;
  let brouillonFormation: string;

  beforeAll(async () => {
    formation = (await creerFormation(banc, "Méthodologie du mémoire", { quiz: false, exercice: null })).id;
    brouillonFormation = (await creerFormation(banc, "En préparation", { quiz: false, exercice: null, statut: "brouillon" })).id;
  });

  it("l'équipe recommande des livres publiés, pas un brouillon ; les autres sont refusés", async () => {
    await banc.en(qui(A), "insert into public.livres_formations (formation_id, livre_id, ordre) values ($1, $2, 1), ($1, $3, 2)", [
      formation,
      gratuit.id,
      reserve.id,
    ]);
    await expect(
      banc.en(qui(A), "insert into public.livres_formations (formation_id, livre_id, ordre) values ($1, $2, 3)", [formation, brouillon.id]),
    ).rejects.toThrow(REFUS);
    await expect(
      banc.en(qui(E), "insert into public.livres_formations (formation_id, livre_id, ordre) values ($1, $2, 3)", [formation, telechargeable.id]),
    ).rejects.toThrow(REFUS);
    await banc.en(qui(A), "insert into public.livres_formations (formation_id, livre_id, ordre) values ($1, $2, 1)", [brouillonFormation, gratuit.id]);
  });

  it("livres_formation : les livres publiés recommandés, dans leur ordre, pour tous ; rien pour une formation pas publiée", async () => {
    expect((await rpc<Carte[]>("anon", "select public.livres_formation($1) as r", [formation])).map((l) => l.id)).toEqual([gratuit.id, reserve.id]);
    expect(await rpc<Carte[]>("anon", "select public.livres_formation($1) as r", [brouillonFormation])).toEqual([]);
    await banc.en(qui(A), "select public.ranger_livre_formation($1, $2, 1)", [formation, reserve.id]);
    expect((await rpc<Carte[]>(qui(E), "select public.livres_formation($1) as r", [formation])).map((l) => l.id)).toEqual([reserve.id, gratuit.id]);
    await expect(banc.en(qui(E), "select public.ranger_livre_formation($1, $2, 1)", [formation, gratuit.id])).rejects.toThrow(/Réservé/);
  });

  it("la fiche d'un livre nomme les formations publiées qui le recommandent", async () => {
    const fiche = await rpc<{ formations: { id: string; titre: string }[] }>("anon", "select public.livre_fiche($1) as r", [gratuit.slug]);
    expect(fiche.formations.map((f) => f.titre)).toEqual(["Méthodologie du mémoire"]);
  });

  it("un livre archivé disparaît des recommandations publiques, sans perdre son lien", async () => {
    await banc.db.query("update public.livres set statut = 'archive' where id = $1", [reserve.id]);
    expect((await rpc<Carte[]>("anon", "select public.livres_formation($1) as r", [formation])).map((l) => l.id)).toEqual([gratuit.id]);
    expect((await un<{ n: number }>("select count(*)::int as n from public.livres_formations where formation_id = $1", [formation])).n).toBe(2);
    await banc.db.query("update public.livres set statut = 'publie' where id = $1", [reserve.id]);
  });
});

describe("Les favoris", () => {
  it("un compte met de côté un livre publié, pas un brouillon ; le catalogue le montre", async () => {
    await banc.en(qui(E), "insert into public.favoris_livres (livre_id) values ($1)", [reserve.id]);
    await expect(banc.en(qui(E), "insert into public.favoris_livres (livre_id) values ($1)", [brouillon.id])).rejects.toThrow(REFUS);
    await expect(banc.en("anon", "insert into public.favoris_livres (livre_id) values ($1)", [gratuit.id])).rejects.toThrow(REFUS);
    expect(await carte(qui(E), reserve)).toMatchObject({ favori: true, ouvert: false });
    expect(await carte(qui(B), reserve)).toMatchObject({ favori: false });
    expect(await banc.en(qui(B), "select livre_id from public.favoris_livres")).toEqual([]);
    expect(await banc.en(qui(E), "delete from public.favoris_livres where livre_id = $1 returning livre_id", [reserve.id])).toEqual([{ livre_id: reserve.id }]);
  });

  it("mes_favoris_livres : les livres publiés mis de côté, du plus récent au plus ancien", async () => {
    await banc.en(qui(B), "insert into public.favoris_livres (livre_id, ajoute_le) values ($1, now() - interval '1 hour')", [gratuit.id]);
    await banc.en(qui(B), "insert into public.favoris_livres (livre_id) values ($1)", [telechargeable.id]);
    expect((await rpc<Carte[]>(qui(B), "select public.mes_favoris_livres() as r")).map((l) => [l.id, l.favori])).toEqual([
      [telechargeable.id, true],
      [gratuit.id, true],
    ]);
    expect(await rpc<Carte[]>("anon", "select public.mes_favoris_livres() as r")).toEqual([]);
  });

  it("un compte suspendu n'en ajoute pas", async () => {
    await expect(banc.en(qui(S), "insert into public.favoris_livres (livre_id) values ($1)", [gratuit.id])).rejects.toThrow(REFUS);
  });
});

describe("Le journal des actions de l'équipe", () => {
  it("publier, archiver et supprimer un livre y entrent, comme pour les formations", async () => {
    await banc.db.query("delete from public.journal_actions");
    const id = randomUUID();
    await banc.en(qui(A), "insert into public.livres (id, titre, slug, fichier, droits_confirmes) values ($1, 'Guide du stage', $2, $3, true)", [
      id,
      `g-${id.slice(0, 8)}`,
      `${id}/${randomUUID()}.pdf`,
    ]);
    await banc.en(qui(A), "update public.livres set statut = 'publie' where id = $1", [id]);
    await banc.en(qui(A), "update public.livres set statut = 'archive' where id = $1", [id]);
    const autre = randomUUID();
    await banc.en(qui(A), "insert into public.livres (id, titre, slug) values ($1, 'Essai', $2)", [autre, `e-${autre.slice(0, 8)}`]);
    await banc.en(qui(A), "delete from public.livres where id = $1", [autre]);
    const { rows } = await banc.db.query<{ categorie: string; action: string; resume: string }>(
      "select categorie, action, resume from public.journal_actions order by id",
    );
    expect(rows).toEqual([
      { categorie: "contenus", action: "livre_statut", resume: "Livre « Guide du stage » : Brouillon → Publié" },
      { categorie: "contenus", action: "livre_statut", resume: "Livre « Guide du stage » : Publié → Archivé" },
      { categorie: "contenus", action: "livre_supprime", resume: "Livre « Essai » supprimé" },
    ]);
  });
});

describe("La migration rejouée", () => {
  it("ne casse rien : livres, lectures et règles restent", async () => {
    const avant = (await un<{ n: number }>("select count(*)::int as n from public.livres")).n;
    const lectures = (await un<{ n: number }>("select count(*)::int as n from public.lectures_livres")).n;
    await banc.appliquer(MIGRATION);
    expect((await un<{ n: number }>("select count(*)::int as n from public.livres")).n).toBe(avant);
    expect((await un<{ n: number }>("select count(*)::int as n from public.lectures_livres")).n).toBe(lectures);
    expect(await acces(qui(E), gratuit)).toBe(true);
    expect(await acces(qui(E), reserve)).toBe(false);
    expect(await banc.en("anon", "select fichier from public.livres")).toEqual([]);
    const espace = await un<{ public: boolean }>("select public from storage.buckets where id = 'bibliotheque'");
    expect(espace.public).toBe(false);
  });
});
