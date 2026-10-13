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
