import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0013 : page Utilisateurs du back-office (spec 2026-10-13-utilisateurs-roles) : suspension d'un compte,
// lecture des comptes par l'équipe, changement des rôles et fiche formateur.
const MIGRATION = "supabase/migrations/0013_utilisateurs.sql";
const REFUS = /row-level security|permission denied/;

let banc: Banc;
const E = randomUUID(); // étudiant, suspendu puis réactivé
const E2 = randomUUID(); // étudiant témoin
const F = randomUUID(); // formateur
const M = randomUUID(); // modérateur
const A = randomUUID(); // admin
const A2 = randomUUID(); // admin, suspendu par le super admin
const S = randomUUID(); // super admin
const S2 = randomUUID(); // second super admin
let excel: string;
let apercu: string;

const suspendu = async (qui: string) => (await banc.en<{ s: boolean }>({ id: qui }, "select public.compte_suspendu() as s"))[0].s;
const suspension = async (compte: string) =>
  (await banc.db.query<{ depuis: string; par: string; motif: string }>("select depuis::text, par::text, motif from public.suspensions where profil_id = $1", [compte])).rows[0];

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
    MIGRATION,
  ]);
  await banc.creerCompte(E);
  await banc.creerCompte(E2);
  await banc.creerCompte(F, ["formateur"]);
  await banc.creerCompte(M, ["moderateur"]);
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(A2, ["admin"]);
  await banc.creerCompte(S, ["super_admin"]);
  await banc.creerCompte(S2, ["super_admin"]);
  excel = (await banc.db.query<{ id: string }>("select id from public.formations where slug = 'maitriser-microsoft-excel'")).rows[0].id;
  apercu = (await banc.db.query<{ id: string }>("select id from public.lecons where titre = 'Découvrir l’interface'")).rows[0].id;
  // E et E2 ont terminé toute la formation Excel : ils peuvent donner un avis (règle des 50 %).
  for (const qui of [E, E2]) {
    await banc.db.query(
      `insert into public.progression_lecons (profil_id, lecon_id, terminee_le)
       select $1, l.id, now() from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $2`,
      [qui, excel],
    );
  }
  // E a déjà une note et un favori.
  await banc.en({ id: E }, "insert into public.notes_lecons (lecon_id, texte) values ($1, 'Ma note')", [apercu]);
  await banc.en({ id: E }, "insert into public.favoris (formation_id) values ($1)", [excel]);
});

describe("Migration 0013 : suspension", () => {
  it("un admin suspend un étudiant ; le compte suspendu le sait, les autres non", async () => {
    await banc.en({ id: A }, "select public.suspendre_compte($1, '  Spam  ')", [E]);
    expect(await suspendu(E)).toBe(true);
    expect(await suspendu(E2)).toBe(false);
    expect(await banc.en<{ s: boolean }>("anon", "select public.compte_suspendu() as s")).toEqual([{ s: false }]);
    expect((await suspension(E)).motif).toBe("Spam");
    expect((await suspension(E)).par).toBe(A);
  });

  it("droits : pas un étudiant, pas un modérateur, pas soi-même, pas un super admin ; l'équipe par le super admin seul", async () => {
    await expect(banc.en({ id: E2 }, "select public.suspendre_compte($1)", [F])).rejects.toThrow(/admin/);
    await expect(banc.en({ id: M }, "select public.suspendre_compte($1)", [F])).rejects.toThrow(/admin/);
    await expect(banc.en("anon", "select public.suspendre_compte($1)", [F])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: A }, "select public.suspendre_compte($1)", [A])).rejects.toThrow(/propre compte/);
    await expect(banc.en({ id: A }, "select public.suspendre_compte($1)", [M])).rejects.toThrow(/super admin/);
    await expect(banc.en({ id: S }, "select public.suspendre_compte($1)", [S2])).rejects.toThrow(/rôle super admin/);
    await expect(banc.en({ id: A }, "select public.suspendre_compte($1)", [randomUUID()])).rejects.toThrow(/introuvable/);
    await expect(banc.en({ id: E2 }, "select public.reactiver_compte($1)", [E])).rejects.toThrow(/admin/);
    await expect(banc.en({ id: A }, "select public.reactiver_compte($1)", [M])).rejects.toThrow(/super admin/);
    // Le super admin suspend un membre de l'équipe ; un admin suspend un formateur.
    await banc.en({ id: S }, "select public.suspendre_compte($1)", [M]);
    await banc.en({ id: S }, "select public.reactiver_compte($1)", [M]);
    await banc.en({ id: A }, "select public.suspendre_compte($1)", [F]);
    await banc.en({ id: A }, "select public.reactiver_compte($1)", [F]);
    expect(await suspendu(M)).toBe(false);
    expect(await suspendu(F)).toBe(false);
  });

  it("suspendre deux fois ou réactiver un compte actif ne change rien", async () => {
    const avant = await suspension(E);
    await banc.en({ id: S }, "select public.suspendre_compte($1, 'Autre motif')", [E]);
    expect(await suspension(E)).toEqual(avant);
    await banc.en({ id: A }, "select public.reactiver_compte($1)", [E2]);
    expect(await suspendu(E2)).toBe(false);
  });

  it("un motif de plus de 500 caractères est coupé", async () => {
    await banc.en({ id: S }, "select public.suspendre_compte($1, $2)", [A2, "x".repeat(600)]);
    expect((await suspension(A2)).motif).toHaveLength(500);
  });

  it("un compte suspendu perd ses droits d'équipe et ses rôles", async () => {
    const [droits] = await banc.en<{ equipe: boolean; admin: boolean }>({ id: A2 }, "select public.equipe_contenus() as equipe, public.a_role('admin') as admin");
    expect(droits).toEqual({ equipe: false, admin: false });
    await expect(
      banc.en({ id: A2 }, "insert into public.parcours (slug, nom, nom_court, couleur) values ('essai-suspendu', 'Essai', 'Essai', 'digital')"),
    ).rejects.toThrow(REFUS);
    const [temoin] = await banc.en<{ equipe: boolean; admin: boolean }>({ id: A }, "select public.equipe_contenus() as equipe, public.a_role('admin') as admin");
    expect(temoin).toEqual({ equipe: true, admin: true });
  });

  it("un compte suspendu ne lit plus aucune leçon, même en aperçu", async () => {
    expect(await banc.en({ id: E }, "select public.acces_lecon($1) as a", [apercu])).toEqual([{ a: false }]);
    expect(await banc.en({ id: E2 }, "select public.acces_lecon($1) as a", [apercu])).toEqual([{ a: true }]);
    expect(await banc.en("anon", "select public.acces_lecon($1) as a", [apercu])).toEqual([{ a: true }]);
    expect(await banc.en({ id: E }, "select lecon_id from public.lecons_contenus where lecon_id = $1", [apercu])).toEqual([]);
  });

  it("un compte suspendu n'écrit plus rien : progression, notes, favoris, avis, profil", async () => {
    await expect(banc.en({ id: E }, "select public.ouvrir_lecon($1)", [apercu])).rejects.toThrow();
    await expect(banc.en({ id: E }, "insert into public.notes_lecons (lecon_id, texte) values ($1, 'Encore')", [apercu])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E }, "delete from public.favoris where formation_id = $1 returning formation_id", [excel])).resolves.toEqual([]);
    await expect(banc.en({ id: E }, "select public.enregistrer_avis($1, 5::smallint, 'Bien')", [excel])).rejects.toThrow();
    await expect(banc.en({ id: E }, "select public.supprimer_avis($1)", [excel])).rejects.toThrow(/suspendu/);
    expect(await banc.en({ id: E }, "update public.profils set prenom = 'Pirate' where id = $1 returning id", [E])).toEqual([]);
    // Ni lecture de ses propres données.
    for (const table of ["notes_lecons", "favoris", "progression_lecons", "avis", "profils"]) {
      expect(await banc.en({ id: E }, `select 1 from public.${table}`)).toEqual([]);
    }
    // Le témoin, lui, écrit normalement.
    await banc.en({ id: E2 }, "select public.enregistrer_avis($1, 4::smallint, 'Bien')", [excel]);
  });

  it("l'équipe lit encore le profil d'un compte suspendu", async () => {
    expect(await banc.en({ id: A }, "select id from public.profils where id = $1", [E])).toEqual([{ id: E }]);
  });

  it("réactiver rend tout, immédiatement", async () => {
    await banc.en({ id: A }, "select public.reactiver_compte($1)", [E]);
    expect(await suspendu(E)).toBe(false);
    expect(await banc.en({ id: E }, "select public.acces_lecon($1) as a", [apercu])).toEqual([{ a: true }]);
    expect(await banc.en({ id: E }, "select texte from public.notes_lecons")).toEqual([{ texte: "Ma note" }]);
    await banc.en({ id: E }, "select public.enregistrer_avis($1, 5::smallint, 'Très bien')", [excel]);
  });

  it("la table des suspensions n'est lisible ni modifiable par personne en direct", async () => {
    await expect(banc.en({ id: A }, "select * from public.suspensions")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: S }, "delete from public.suspensions")).rejects.toThrow(REFUS);
  });

  it("la migration est rejouable", async () => {
    await banc.appliquer(MIGRATION);
    expect(await suspendu(A2)).toBe(true);
  });
});

type Compte = { id: string; prenom: string; nom: string; email: string; roles: string[]; inscrit_le: string; derniere_connexion: string | null; suspendu: boolean };
type PageComptes = { total: number; comptes: Compte[] };
type Fiche = {
  id: string;
  email: string;
  roles: string[];
  derniere_connexion: string | null;
  suspension: { depuis: string; par_nom: string; motif: string } | null;
  fiche_formateur: { id: string; nom: string } | null;
  formations: { titre: string; terminees: number; total: number; derniere_activite: string }[];
  avis: { formation_titre: string; note: number; commentaire: string; masque: boolean }[];
};

const liste = async (qui: string, recherche = "", filtre = "tous", page = 1) =>
  (await banc.en<{ r: PageComptes }>({ id: qui }, "select public.comptes_equipe($1, $2, $3) as r", [recherche, filtre, page]))[0].r;
const ids = (p: PageComptes) => p.comptes.map((c) => c.id);
const fiche = async (qui: string, compte: string) => (await banc.en<{ r: Fiche | null }>({ id: qui }, "select public.compte_equipe($1) as r", [compte]))[0].r;
const roles = async (compte: string) =>
  (await banc.db.query<{ nom: string }>("select r.role::text as nom from public.roles r where r.profil_id = $1 order by r.role", [compte])).rows.map((r) => r.nom);
const ficheDe = async (compte: string) => (await banc.db.query<{ id: string; nom: string }>("select id, nom from public.formateurs where compte_id = $1", [compte])).rows[0];

describe("Migration 0013 : comptes et rôles", () => {
  beforeAll(async () => {
    await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'Adjovi' where id = $1", [E2]);
    await banc.db.query("update auth.users set last_sign_in_at = '2026-10-13T08:00:00Z' where id = $1", [E]);
  });

  it("la liste : l'équipe (modérateur compris) la lit ; un étudiant, un formateur, un admin suspendu et un visiteur sont refusés", async () => {
    const page = await liste(M);
    expect(page.total).toBeGreaterThanOrEqual(8);
    expect(ids(page)).toEqual(expect.arrayContaining([E, E2, F, M, A, A2, S, S2]));
    const e = page.comptes.find((c) => c.id === E)!;
    expect(e).toMatchObject({ email: `${E.slice(0, 8)}@exemple.com`, roles: ["etudiant"], suspendu: false, derniere_connexion: expect.stringContaining("2026-10-13") });
    expect(page.comptes.find((c) => c.id === A2)).toMatchObject({ roles: ["etudiant", "admin"], suspendu: true, derniere_connexion: null });
    for (const qui of [E, F, A2]) await expect(banc.en({ id: qui }, "select public.comptes_equipe()")).rejects.toThrow(/équipe/);
    await expect(banc.en("anon", "select public.comptes_equipe()")).rejects.toThrow(REFUS);
  });

  it("recherche par nom sans accents ni majuscules, et par adresse e-mail", async () => {
    expect(ids(await liste(A, "fifame"))).toEqual([E2]);
    expect(ids(await liste(A, "ADJO"))).toEqual([E2]);
    expect(ids(await liste(A, "Fifamè Adj"))).toEqual([E2]);
    expect(ids(await liste(A, `  ${E.slice(0, 8).toUpperCase()}@EXEMPLE  `))).toEqual([E]);
  });

  it("une recherche avec % _ ou ' ne plante pas et ne sert pas de joker", async () => {
    for (const q of ["%", "_", "l'a", "\\"]) expect((await liste(A, q)).total).toBe(0);
  });

  it("filtres : étudiants, formateurs, équipe, suspendus ; une valeur inconnue vaut « tous »", async () => {
    const etudiants = ids(await liste(A, "", "etudiants"));
    expect(etudiants).toEqual(expect.arrayContaining([E, E2]));
    expect(etudiants.some((id) => [F, M, A, A2, S, S2].includes(id))).toBe(false);
    expect(ids(await liste(A, "", "formateurs"))).toEqual([F]);
    expect([...ids(await liste(A, "", "equipe"))].sort()).toEqual([M, A, A2, S, S2].sort());
    expect(ids(await liste(A, "", "suspendus"))).toEqual([A2]);
    expect((await liste(A, "", "nimporte")).total).toBe((await liste(A)).total);
  });

  it("la fiche : identité, rôles, suspension, activité (formations suivies et avis)", async () => {
    const e = (await fiche(M, E))!;
    expect(e).toMatchObject({ id: E, email: `${E.slice(0, 8)}@exemple.com`, roles: ["etudiant"], suspension: null, fiche_formateur: null });
    expect(e.formations).toHaveLength(1);
    expect(e.formations[0].titre).toMatch(/Excel/);
    expect(e.formations[0].total).toBeGreaterThan(0);
    expect(e.formations[0].terminees).toBe(e.formations[0].total);
    expect(e.avis).toEqual([expect.objectContaining({ note: 5, commentaire: "Très bien", masque: false, formation_titre: expect.stringMatching(/Excel/) })]);
    const a2 = (await fiche(A, A2))!;
    expect(a2.suspension).toMatchObject({ par_nom: expect.stringMatching(/^Test /) });
    expect(a2.suspension!.motif).toHaveLength(500);
    expect(a2.formations).toEqual([]);
    expect(a2.avis).toEqual([]);
    expect(await fiche(A, randomUUID())).toBeNull();
    await expect(banc.en({ id: E2 }, "select public.compte_equipe($1)", [E])).rejects.toThrow(/équipe/);
  });

  it("seul le super admin change les rôles ; Étudiant est toujours gardé", async () => {
    await expect(banc.en({ id: A }, "select public.changer_roles($1, '{moderateur}')", [E])).rejects.toThrow(/super admin/);
    await banc.en({ id: S }, "select public.changer_roles($1, '{moderateur}')", [E]);
    expect(await roles(E)).toEqual(["etudiant", "moderateur"]);
    await banc.en({ id: S }, "select public.changer_roles($1, '{}')", [E]);
    expect(await roles(E)).toEqual(["etudiant"]);
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{}')", [randomUUID()])).rejects.toThrow(/introuvable/);
  });

  it("le super admin ne se retire pas son propre rôle super admin ; il peut le retirer à un autre", async () => {
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{admin}')", [S])).rejects.toThrow(/vous retirer/);
    await banc.en({ id: S }, "select public.changer_roles($1, '{super_admin, admin}')", [S]);
    expect(await roles(S)).toEqual(["etudiant", "admin", "super_admin"]);
    await banc.en({ id: S }, "select public.changer_roles($1, '{admin}')", [S2]);
    expect(await roles(S2)).toEqual(["etudiant", "admin"]);
  });

  it("Formateur demande une fiche : existante libre, ou créée à son nom ; retirer le rôle la détache", async () => {
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{formateur}')", [E2])).rejects.toThrow(/Choisissez la fiche formateur/);
    await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [E2]);
    const creee = await ficheDe(E2);
    expect(creee.nom).toBe("Fifamè Adjovi");
    expect(await roles(E2)).toEqual(["etudiant", "formateur"]);
    expect((await fiche(A, E2))!.fiche_formateur).toEqual({ id: creee.id, nom: "Fifamè Adjovi" });
    // Déjà formateur avec sa fiche : une nouvelle demande ne crée rien de plus.
    await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [E2]);
    expect((await banc.db.query("select 1 from public.formateurs where compte_id = $1", [E2])).rows).toHaveLength(1);
    // Retirer le rôle détache la fiche, qui reste.
    await banc.en({ id: S }, "select public.changer_roles($1, '{}')", [E2]);
    expect(await ficheDe(E2)).toBeUndefined();
    expect((await banc.db.query("select compte_id from public.formateurs where id = $1", [creee.id])).rows).toEqual([{ compte_id: null }]);
    // Une fiche existante libre se relie ; déjà reliée, elle est refusée à un autre compte.
    await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', $2)", [F, creee.id]);
    expect((await ficheDe(F)).id).toBe(creee.id);
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', $2)", [E2, creee.id])).rejects.toThrow(/déjà reliée/);
    expect(await roles(E2)).toEqual(["etudiant"]);
  });

  it("une fiche formateur n'est reliée qu'à un compte", async () => {
    const autre = (await banc.db.query<{ id: string }>("select id from public.formateurs where compte_id is null limit 1")).rows[0].id;
    await expect(banc.db.query("update public.formateurs set compte_id = $1 where id = $2", [F, autre])).rejects.toThrow(/formateurs_compte_unique/);
  });

  it("un compte suspendu ne reçoit pas de nouveau rôle ; on peut lui en retirer", async () => {
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{admin, moderateur}')", [A2])).rejects.toThrow(/Réactivez le compte/);
    await banc.en({ id: S }, "select public.changer_roles($1, '{}')", [A2]);
    expect(await roles(A2)).toEqual(["etudiant"]);
  });

  it("pages de 25, les plus récents d'abord ; une page < 1 vaut 1", async () => {
    const nouveaux = Array.from({ length: 30 }, () => randomUUID());
    for (const id of nouveaux) await banc.creerCompte(id);
    const p1 = await liste(A);
    const p2 = await liste(A, "", "tous", 2);
    expect(p1.comptes).toHaveLength(25);
    expect(p2.comptes).toHaveLength(p1.total - 25);
    expect(p2.total).toBe(p1.total);
    expect(p1.comptes[0].id).toBe(nouveaux[29]);
    expect(ids(await liste(A, "", "tous", 0))).toEqual(ids(p1));
  });

  it("la migration reste rejouable", async () => {
    await banc.appliquer(MIGRATION);
    expect((await fiche(A, F))!.fiche_formateur).not.toBeNull();
  });
});
