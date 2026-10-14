import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0016 : centre de notifications (spec 2026-10-14-notifications). Seule la base écrit les notifications
// (notifier) ; elle respecte les préférences du profil et n'avertit jamais l'auteur de l'action.
const MIGRATION = "supabase/migrations/0016_notifications.sql";
const REFUS = /row-level security|permission denied/;

let banc: Banc;
const E1 = randomUUID();
const E2 = randomUUID();
const E3 = randomUUID();
const A = randomUUID(); // admin
const S = randomUUID(); // super admin

type Ligne = { id: number; categorie: string; titre: string; texte: string; lien: string | null; cree_le: string; lue: boolean };
type Lot = { lignes: Ligne[]; suite: boolean; non_lues: number };
type Recue = { categorie: string; titre: string; texte: string; lien: string | null };

const listeSql = (ids: string[]) => `{${ids.join(",")}}`;

/** notifier, appelé par la base pendant une action de ce compte (null : sans compte, comme l'éditeur SQL). */
async function notifierEn(auteur: string | null, destinataires: string[], categorie: string, titre: string, texte = "", lien: string | null = null) {
  return banc.db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [auteur ?? ""]);
    const { rows } = await tx.query<{ n: number }>("select public.notifier($1::uuid[], $2, $3, $4, $5) as n", [listeSql(destinataires), categorie, titre, texte, lien]);
    return rows[0].n;
  });
}
const recues = async (compte: string) =>
  (await banc.db.query<Recue>("select categorie, titre, texte, lien from public.notifications where destinataire = $1 order by id", [compte])).rows;
const mes = async (compte: string, nonLues = false, avant: number | null = null, nombre = 20) =>
  (await banc.en<{ r: Lot }>({ id: compte }, "select public.mes_notifications($1, $2, $3) as r", [nonLues, avant, nombre]))[0].r;
const preferences = (compte: string, valeurs: Record<string, boolean>) =>
  banc.db.query("update public.profils set preferences_notifications = preferences_notifications || $2::jsonb where id = $1", [compte, JSON.stringify(valeurs)]);

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
    MIGRATION,
  ]);
  for (const [id, roles] of [[E1, []], [E2, []], [E3, []], [A, ["admin"]], [S, ["super_admin"]]] as const) await banc.creerCompte(id, [...roles]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
  await banc.db.query("update public.profils set preferences_notifications = default");
});

describe("La table et notifier", () => {
  it("notifier : une ligne par destinataire, jamais l'auteur de l'action ; rend le nombre", async () => {
    expect(await notifierEn(E1, [E1, E2, E2, randomUUID()], "annonces", "Nouveautés", "Le texte.", "/accueil")).toBe(1);
    expect(await recues(E2)).toEqual([{ categorie: "annonces", titre: "Nouveautés", texte: "Le texte.", lien: "/accueil" }]);
    expect(await recues(E1)).toEqual([]);
    // Sans compte (éditeur SQL) : personne n'est écarté.
    expect(await notifierEn(null, [E1], "service", "Bienvenue")).toBe(1);
  });

  it("préférences : catégorie coupée → rien ; service passe ; canal dans l'appli coupé → rien, service compris", async () => {
    await preferences(E1, { annonces: false });
    expect(await notifierEn(null, [E1], "annonces", "Annonce")).toBe(0);
    expect(await notifierEn(null, [E1], "nouveaux_contenus", "Nouvelle formation")).toBe(1);
    expect(await notifierEn(null, [E1], "service", "Votre compte est réactivé")).toBe(1);
    await preferences(E2, { canal_appli: false });
    expect(await notifierEn(null, [E2], "annonces", "Annonce")).toBe(0);
    expect(await notifierEn(null, [E2], "service", "Votre compte est réactivé")).toBe(0);
    expect(await recues(E2)).toEqual([]);
  });

  it("une clé absente des préférences vaut activée", async () => {
    await banc.db.query("update public.profils set preferences_notifications = '{}'::jsonb where id = $1", [E1]);
    expect(await notifierEn(null, [E1], "nouveaux_contenus", "Nouvelle leçon")).toBe(1);
    expect(await notifierEn(null, [E1], "service", "Service")).toBe(1);
  });

  it("titre et texte coupés à 200 et 400 caractères", async () => {
    await notifierEn(null, [E1], "annonces", "t".repeat(250), "x".repeat(500));
    const [n] = await recues(E1);
    expect([n.titre.length, n.texte.length]).toEqual([200, 400]);
  });

  it("une catégorie inconnue ou un lien hors du site sont refusés", async () => {
    await expect(notifierEn(null, [E1], "inconnue", "Titre")).rejects.toThrow(/notifications_categorie/);
    await expect(notifierEn(null, [E1], "annonces", "Titre", "", "//site.com")).rejects.toThrow(/notifications_lien/);
    await expect(notifierEn(null, [E1], "annonces", "Titre", "", "https://site.com")).rejects.toThrow(/notifications_lien/);
  });
});

describe("Lecture par les comptes", () => {
  it("mes_notifications : les siennes, plus récentes d'abord ; non lues seulement ; non_lues ; suite", async () => {
    for (const titre of ["N1", "N2", "N3"]) await notifierEn(null, [E1], "annonces", titre, "Texte", "/accueil");
    await notifierEn(null, [E2], "annonces", "Pour E2");
    await banc.db.query("update public.notifications set lue_le = now() where titre = 'N1'");

    const tout = await mes(E1);
    expect(tout.lignes.map((l) => [l.titre, l.lue])).toEqual([["N3", false], ["N2", false], ["N1", true]]);
    expect(Object.keys(tout.lignes[0]).sort()).toEqual(["categorie", "cree_le", "id", "lien", "lue", "texte", "titre"]);
    expect(tout.lignes[0]).toMatchObject({ categorie: "annonces", texte: "Texte", lien: "/accueil" });
    expect([tout.suite, tout.non_lues]).toEqual([false, 2]);

    expect((await mes(E1, true)).lignes.map((l) => l.titre)).toEqual(["N3", "N2"]);
    const deux = await mes(E1, false, null, 2);
    expect([deux.lignes.length, deux.suite, deux.non_lues]).toEqual([2, true, 2]);
    // Nombre borné entre 1 et 50.
    expect((await mes(E1, false, null, 0)).lignes).toHaveLength(1);
  });

  it("Voir plus : 25 notifications de la même seconde, lues par 20 puis à partir de la dernière : 25 distinctes", async () => {
    await banc.db.query("select public.notifier(array[$1]::uuid[], 'nouveaux_contenus', 'N' || g, '', null) from generate_series(1, 25) g", [E1]);
    const premiere = await mes(E1, false, null, 20);
    expect([premiere.lignes.length, premiere.suite]).toEqual([20, true]);
    const seconde = await mes(E1, false, premiere.lignes[19].id, 20);
    expect([seconde.lignes.length, seconde.suite]).toEqual([5, false]);
    const titres = [...premiere.lignes, ...seconde.lignes].map((l) => l.titre);
    expect(new Set(titres).size).toBe(25);
    expect(titres[0]).toBe("N25");
    expect(titres[24]).toBe("N1");
  });

  it("marquer_lues : null marque toutes les siennes ; une liste ne touche jamais celles d'un autre", async () => {
    await notifierEn(null, [E1], "annonces", "A1");
    await notifierEn(null, [E1], "annonces", "A2");
    await notifierEn(null, [E2], "annonces", "B1");
    const idDe = async (titre: string) => (await banc.db.query<{ id: number }>("select id from public.notifications where titre = $1", [titre])).rows[0].id;

    await banc.en({ id: E1 }, "select public.marquer_lues($1::bigint[])", [`{${await idDe("B1")}}`]);
    expect((await mes(E2)).non_lues).toBe(1);
    await banc.en({ id: E1 }, "select public.marquer_lues($1::bigint[])", [`{${await idDe("A1")}}`]);
    expect((await mes(E1)).lignes.map((l) => [l.titre, l.lue])).toEqual([["A2", false], ["A1", true]]);
    await banc.en({ id: E1 }, "select public.marquer_lues(null)");
    expect((await mes(E1)).non_lues).toBe(0);
    expect((await mes(E2)).non_lues).toBe(1);
  });

  it("aucune écriture directe : insert refusé ; update d'une autre colonne que lue_le refusé ; notifier refusé à un compte", async () => {
    await notifierEn(null, [E2], "annonces", "Pour E2");
    await expect(banc.en({ id: E1 }, "insert into public.notifications (destinataire, categorie, titre) values ($1, 'annonces', 'x')", [E1])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E2 }, "update public.notifications set titre = 'x'")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E2 }, "delete from public.notifications")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: A }, "select public.notifier(array[$1]::uuid[], 'annonces', 'x', '', null)", [E1])).rejects.toThrow(REFUS);
    await expect(banc.en("anon", "select * from public.notifications")).rejects.toThrow(REFUS);
    // Celles d'un autre : ni lues, ni marquées.
    expect(await banc.en({ id: E1 }, "select * from public.notifications")).toEqual([]);
    await banc.en({ id: E1 }, "update public.notifications set lue_le = now()");
    expect((await mes(E2)).non_lues).toBe(1);
  });

  it("un compte suspendu ne lit rien", async () => {
    await notifierEn(null, [E3], "annonces", "Pour E3");
    await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [E3]);
    try {
      expect(await mes(E3)).toEqual({ lignes: [], suite: false, non_lues: 0 });
      expect(await banc.en({ id: E3 }, "select * from public.notifications")).toEqual([]);
    } finally {
      await banc.db.query("delete from public.suspensions where profil_id = $1", [E3]);
    }
  });

  it("plus de 6 mois : effacées au prochain envoi au même destinataire", async () => {
    await notifierEn(null, [E1], "annonces", "Vieille");
    await banc.db.query("update public.notifications set cree_le = now() - interval '7 months'");
    await notifierEn(null, [E2], "annonces", "Pour E2");
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Vieille"]);
    await notifierEn(null, [E1], "annonces", "Récente");
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Récente"]);
  });

  it("la migration est rejouable", async () => {
    await notifierEn(null, [E1], "annonces", "Gardée");
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect((await recues(E1)).map((n) => n.titre)).toEqual(["Gardée"]);
  });
});

describe("Les événements qui notifient", () => {
  const F = randomUUID(); // formateur « Mireille Akpo », fiche FA
  const M = randomUUID(); // modérateur
  let FA: string;
  let P1: string; // nom court « Académique »
  let P2: string; // nom court « Digital »
  type Formation = { id: string; slug: string; titre: string; module: string; lecon: string };
  let W: Formation; // publiée, dans P1 : suivie par E1, E3, F et A
  let V: Formation; // publiée, dans P2 : suivie par E2 et E3

  const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
  const toutEffacer = () => banc.db.query("delete from public.notifications");
  const aucune = async () => (await banc.db.query("select * from public.notifications")).rows;
  async function nouvelleFormation(titre: string, parcours: string[], statut = "brouillon"): Promise<Formation> {
    const slug = `f-${randomUUID()}`;
    const f = await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, statut) values ($1, $2, $3, $4) returning id", [titre, slug, FA, statut]);
    for (const [i, p] of parcours.entries()) await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, $3)", [f.id, p, i]);
    const m = await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 1', 1) returning id", [f.id]);
    const l = await un<{ id: string }>("insert into public.lecons (module_id, titre, ordre) values ($1, 'Leçon 1', 1) returning id", [m.id]);
    return { id: f.id, slug, titre, module: m.id, lecon: l.id };
  }
  const suivre = (compte: string, lecon: string, terminee = false) =>
    banc.db.query("insert into public.progression_lecons (profil_id, lecon_id, terminee_le) values ($1, $2, case when $3 then now() end) on conflict do nothing", [compte, lecon, terminee]);
  const parcours = async (nomCourt: string, ordre: number) =>
    (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, $2, $3, 'academique', $4) returning id", [`p-${randomUUID()}`, `Parcours ${nomCourt}`, nomCourt, ordre])).id;

  beforeAll(async () => {
    for (const [id, roles] of [[F, []], [M, ["moderateur"]]] as const) await banc.creerCompte(id, [...roles]);
    await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Akpo' where id = $1", [F]);
    await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'Adjovi' where id = $1", [E2]);
    await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [F]);
    FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
    P1 = await parcours("Académique", -2);
    P2 = await parcours("Digital", -1);
    W = await nouvelleFormation("Méthodologie du mémoire", [P1], "publiee");
    V = await nouvelleFormation("Canva", [P2], "publiee");
    for (const compte of [E1, E3, F, A]) await suivre(compte, W.lecon);
    for (const compte of [E2, E3]) await suivre(compte, V.lecon);
  });

  it("première publication : E1 « Dans le parcours Académique. », E2 celui de P2, une seule fois chacun ; F : « Votre formation est en ligne »", async () => {
    const X = await nouvelleFormation("Maîtriser Microsoft Excel", [P1, P2]);
    await toutEffacer();
    await banc.en({ id: A }, "update public.formations set statut = 'publiee' where id = $1", [X.id]);
    const nouvelle = (parcoursNom: string) => ({ categorie: "nouveaux_contenus", titre: "Nouvelle formation : Maîtriser Microsoft Excel", texte: `Dans le parcours ${parcoursNom}.`, lien: `/formations/${X.slug}` });
    expect(await recues(E1)).toEqual([nouvelle("Académique")]);
    expect(await recues(E2)).toEqual([nouvelle("Digital")]);
    expect(await recues(E3)).toEqual([nouvelle("Académique")]);
    // L'admin qui publie suit aussi le parcours : jamais notifié de sa propre action.
    expect(await recues(A)).toEqual([]);
    expect(await recues(F)).toEqual([{ categorie: "service", titre: "Votre formation est en ligne", texte: "Maîtriser Microsoft Excel", lien: `/formateur/formations/${X.id}` }]);
  });

  it("le formateur qui suit le parcours ne reçoit pas « Nouvelle formation »", async () => {
    const X = await nouvelleFormation("Zotero", [P1]);
    await toutEffacer();
    await banc.en({ id: A }, "update public.formations set statut = 'publiee' where id = $1", [X.id]);
    expect((await recues(F)).map((n) => n.titre)).toEqual(["Votre formation est en ligne"]);
  });

  it("archiver puis republier : « Formation archivée » à ses étudiants, puis aucune nouvelle annonce de formation", async () => {
    const Y = await nouvelleFormation("PowerPoint", [P1], "publiee");
    await suivre(E1, Y.lecon);
    await toutEffacer();
    await banc.en({ id: A }, "update public.formations set statut = 'archivee' where id = $1", [Y.id]);
    expect(await recues(E1)).toEqual([{ categorie: "service", titre: "Formation archivée", texte: "PowerPoint n’est plus disponible. Votre progression est conservée.", lien: "/mes-formations" }]);
    expect(await recues(E2)).toEqual([]);
    await toutEffacer();
    await banc.en({ id: A }, "update public.formations set statut = 'publiee' where id = $1", [Y.id]);
    expect(await aucune()).toEqual([]);
  });

  it("nouvelle leçon : ses étudiants, lien vers la leçon ; dans un brouillon : rien ; jamais l'auteur", async () => {
    await toutEffacer();
    const [l] = await banc.en<{ id: string }>({ id: F }, "insert into public.lecons (module_id, titre, ordre) values ($1, 'Construire sa problématique', 2) returning id", [W.module]);
    const lecon = { categorie: "nouveaux_contenus", titre: "Nouvelle leçon dans Méthodologie du mémoire", texte: "Construire sa problématique", lien: `/formations/${W.slug}/lecons/${l.id}` };
    expect(await recues(E1)).toEqual([lecon]);
    expect(await recues(A)).toEqual([lecon]);
    expect(await recues(E2)).toEqual([]);
    expect(await recues(F)).toEqual([]);
    const B = await nouvelleFormation("Brouillon", [P1]);
    await suivre(E1, B.lecon);
    await toutEffacer();
    await banc.en({ id: F }, "insert into public.lecons (module_id, titre, ordre) values ($1, 'Leçon 2', 2)", [B.module]);
    expect(await aucune()).toEqual([]);
  });

  it("envoi en relecture : admin, modérateur et super admin, pas le formateur ; un second envoi pendant l'attente : rien", async () => {
    const X = await nouvelleFormation("Word", [P1]);
    await toutEffacer();
    await banc.en({ id: F }, "select public.envoyer_en_relecture($1)", [X.id]);
    const avalider = { categorie: "service", titre: "Formation à valider", texte: "Word, par Mireille Akpo", lien: `/admin/formations/${X.id}?onglet=publication` };
    for (const compte of [A, M, S]) expect(await recues(compte)).toEqual([avalider]);
    expect(await recues(F)).toEqual([]);
    expect(await recues(E1)).toEqual([]);
    await banc.en({ id: F }, "select public.envoyer_en_relecture($1)", [X.id]);
    expect(await recues(A)).toHaveLength(1);
  });

  it("renvoi : le formateur, la remarque coupée à 120 caractères avec « … »", async () => {
    const X = await nouvelleFormation("Excel avancé", [P1]);
    await banc.en({ id: F }, "select public.envoyer_en_relecture($1)", [X.id]);
    await toutEffacer();
    const longue = `${"a".repeat(119)}bcdef`;
    await banc.en({ id: A }, "select public.renvoyer_au_formateur($1, $2)", [X.id, longue]);
    const lien = `/formateur/formations/${X.id}?onglet=publication`;
    expect(await recues(F)).toEqual([{ categorie: "service", titre: "Votre formation est à corriger", texte: `${"a".repeat(119)}…`, lien }]);
    expect(await recues(A)).toEqual([]);
    await banc.en({ id: F }, "select public.envoyer_en_relecture($1)", [X.id]);
    await banc.en({ id: A }, "select public.renvoyer_au_formateur($1, $2)", [X.id, "Ajoutez une vidéo."]);
    expect((await recues(F)).map((n) => n.texte)).toEqual([`${"a".repeat(119)}…`, "Ajoutez une vidéo."]);
  });

  it("nouvel avis : le formateur, « Fifamè A. : 4/5 » ; modifier ou masquer l'avis : rien", async () => {
    const Z = await nouvelleFormation("Canva avancé", [P2], "publiee");
    await suivre(E2, Z.lecon, true);
    await toutEffacer();
    await banc.en({ id: E2 }, "select public.enregistrer_avis($1, 4::smallint, 'Très clair')", [Z.id]);
    expect(await recues(F)).toEqual([{ categorie: "service", titre: "Nouvel avis sur Canva avancé", texte: "Fifamè A. : 4/5", lien: `/formations/${Z.slug}` }]);
    await toutEffacer();
    await banc.en({ id: E2 }, "select public.enregistrer_avis($1, 5::smallint, 'Excellent')", [Z.id]);
    const avis = await un<{ id: string }>("select id from public.avis where profil_id = $1 and formation_id = $2", [E2, Z.id]);
    await banc.en({ id: A }, "select public.masquer_avis($1, true)", [avis.id]);
    expect(await aucune()).toEqual([]);
  });

  it("rôles : « Vous êtes formateur » ; admin et modérateur d'un coup : une seule « équipe » ; un rôle d'équipe de plus : rien ; ses propres rôles : rien", async () => {
    const [R1, R2, R3] = [randomUUID(), randomUUID(), randomUUID()];
    for (const id of [R1, R2, R3]) await banc.creerCompte(id);
    expect(await recues(R3)).toEqual([]);
    await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [R1]);
    expect(await recues(R1)).toEqual([{ categorie: "service", titre: "Vous êtes formateur", texte: "Créez et suivez vos formations depuis l’espace formateur.", lien: "/formateur" }]);
    await banc.en({ id: S }, "select public.changer_roles($1, '{admin,moderateur}')", [R2]);
    expect(await recues(R2)).toEqual([{ categorie: "service", titre: "Vous faites partie de l’équipe", texte: "Le back-office vous est ouvert.", lien: "/admin" }]);
    await banc.en({ id: S }, "select public.changer_roles($1, '{admin,moderateur,super_admin}')", [R2]);
    expect(await recues(R2)).toHaveLength(1);
    await toutEffacer();
    await banc.en({ id: S }, "select public.changer_roles($1, '{super_admin,moderateur}')", [S]);
    expect(await recues(S)).toEqual([]);
  });

  it("réactivation : « Votre compte est réactivé » ; supprimer un compte suspendu (auth.users) réussit", async () => {
    const [R4, R5] = [randomUUID(), randomUUID()];
    for (const id of [R4, R5]) await banc.creerCompte(id);
    await banc.en({ id: A }, "select public.suspendre_compte($1, 'Test')", [R4]);
    expect(await recues(R4)).toEqual([]);
    await banc.en({ id: A }, "select public.reactiver_compte($1)", [R4]);
    expect(await recues(R4)).toEqual([{ categorie: "service", titre: "Votre compte est réactivé", texte: "Vous retrouvez tous vos accès.", lien: "/accueil" }]);
    await banc.en({ id: A }, "select public.suspendre_compte($1, 'Test')", [R5]);
    await banc.db.query("delete from auth.users where id = $1", [R5]);
    expect((await banc.db.query("select id from public.profils where id = $1", [R5])).rows).toEqual([]);
  });
});

describe("Les annonces", () => {
  type AnnonceLue = { id: string; titre: string; texte: string; lien: string | null; auteur: string; cree_le: string; destinataires: number };
  const publier = (qui: string, titre: string, texte: string, lien: string | null = null) =>
    banc.en<{ n: number }>({ id: qui }, "select public.publier_annonce($1, $2, $3) as n", [titre, texte, lien]);
  const LIEN_REFUSE = /Le lien doit être une adresse du site, commençant par « \/ »\./;

  beforeAll(async () => {
    await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [A]);
  });

  it("une annonce : tous les comptes sauf son auteur et ceux qui ont coupé les annonces ; nombre rendu et gardé", async () => {
    await preferences(E1, { annonces: false });
    const comptes = Number((await banc.db.query<{ n: number }>("select count(*)::int as n from public.profils")).rows[0].n);
    const [{ n }] = await publier(A, "  Nouveautés d’octobre  ", "La page Notifications est en ligne.", "/notifications");
    expect(n).toBe(comptes - 2);
    expect(await recues(E2)).toEqual([{ categorie: "annonces", titre: "Nouveautés d’octobre", texte: "La page Notifications est en ligne.", lien: "/notifications" }]);
    expect(await recues(E1)).toEqual([]);
    expect(await recues(A)).toEqual([]);
    const [gardee] = (await banc.db.query<{ titre: string; destinataires: number; auteur: string }>("select titre, destinataires, auteur from public.annonces order by cree_le desc limit 1")).rows;
    expect(gardee).toEqual({ titre: "Nouveautés d’octobre", destinataires: comptes - 2, auteur: A });
  });

  it("refusée à un étudiant et à un formateur", async () => {
    const FO = randomUUID();
    await banc.creerCompte(FO, ["formateur"]);
    for (const qui of [E1, FO]) await expect(publier(qui, "Titre", "Texte")).rejects.toThrow("Accès réservé à l’équipe.");
  });

  it("titre, texte et lien vérifiés ; https://…, //site.com, javascript:… refusés ; / et /formations/excel acceptés", async () => {
    for (const titre of ["   ", "t".repeat(81)]) await expect(publier(A, titre, "Texte")).rejects.toThrow("Écrivez un titre (80 caractères au plus).");
    for (const texte of ["", "x".repeat(301)]) await expect(publier(A, "Titre", texte)).rejects.toThrow("Écrivez le texte de l’annonce (300 caractères au plus).");
    for (const lien of ["https://site.com", "//site.com", "javascript:alert(1)", "/a b", "/\\site.com", "formations"]) {
      await expect(publier(A, "Titre", "Texte", lien)).rejects.toThrow(LIEN_REFUSE);
    }
    for (const lien of ["/", "/formations/excel"]) await publier(A, "Titre", "Texte", lien);
    await publier(A, "Sans lien", "Texte", "   ");
    const liens = (await banc.db.query<{ lien: string | null }>("select lien from public.annonces where titre in ('Titre', 'Sans lien') order by cree_le")).rows.map((r) => r.lien);
    expect(liens).toEqual(["/", "/formations/excel", null]);
  });

  it("annonces_equipe : la liste avec l'auteur ; refusée à un étudiant ; la table n'est pas lisible directement", async () => {
    const T = randomUUID();
    await banc.creerCompte(T, ["admin"]);
    await publier(T, "D’un compte supprimé", "Texte");
    await banc.db.query("delete from auth.users where id = $1", [T]);
    await publier(A, "La plus récente", "Texte", "/accueil");
    const [{ r }] = await banc.en<{ r: AnnonceLue[] }>({ id: S }, "select public.annonces_equipe() as r");
    expect(Object.keys(r[0]).sort()).toEqual(["auteur", "cree_le", "destinataires", "id", "lien", "texte", "titre"]);
    expect(r[0]).toMatchObject({ titre: "La plus récente", auteur: "Aïcha Kpadé", lien: "/accueil" });
    expect(r[1]).toMatchObject({ titre: "D’un compte supprimé", auteur: "Compte supprimé" });
    await expect(banc.en({ id: E1 }, "select public.annonces_equipe()")).rejects.toThrow("Accès réservé à l’équipe.");
    await expect(banc.en({ id: A }, "select * from public.annonces")).rejects.toThrow(REFUS);
  });
});
