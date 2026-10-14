import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0017 : un seul rôle en plus d'étudiant. Deux espaces au plus : étudiant et formateur, ou étudiant et
// back-office. Donner le rôle Formateur crée sa fiche (ou lui rend la sienne) : plus jamais de fiche à choisir.
const MIGRATION = "supabase/migrations/0017_role_unique.sql";
const REFUS = /row-level security|permission denied/;
const UN_SEUL = /Un compte n’a qu’un rôle en plus d’étudiant/;

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
// Comptes posés avant la 0017, dans des états qu'elle remet en ordre :
const FA = randomUUID(); // formateur ET admin, relié à une fiche
const AM = randomUUID(); // admin ET modérateur
const FS = randomUUID(); // formateur sans fiche

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const roles = async (compte: string) =>
  (await banc.db.query<{ nom: string }>("select r.role::text as nom from public.roles r where r.profil_id = $1 order by r.role", [compte])).rows.map((r) => r.nom);
const fiche = (compte: string) => un<{ id: string; nom: string } | undefined>("select id, nom from public.formateurs where compte_id = $1", [compte]);
const changer = (qui: string, compte: string, role: string) => banc.en({ id: qui }, "select public.changer_role($1, $2::public.role_etudium)", [compte, role]);
const titres = async (compte: string) =>
  (await banc.db.query<{ titre: string }>("select titre from public.notifications where destinataire = $1 order by id", [compte])).rows.map((r) => r.titre);

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
    "supabase/migrations/0016_notifications.sql",
  ]);
  for (const [id, r] of [[S, ["super_admin"]], [A, ["admin"]], [FA, ["formateur", "admin"]], [AM, ["admin", "moderateur"]], [FS, ["formateur"]]] as const) {
    await banc.creerCompte(id, [...r]);
  }
  await banc.db.query("insert into public.formateurs (nom, compte_id) values ('Fiche de FA', $1)", [FA]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Akpo' where id = $1", [FS]);
  await banc.appliquer(MIGRATION);
});

describe("Remise en ordre des comptes existants", () => {
  it("formateur et admin : il perd Formateur, garde le back-office ; sa fiche est détachée mais gardée", async () => {
    expect(await roles(FA)).toEqual(["etudiant", "admin"]);
    expect(await fiche(FA)).toBeUndefined();
    expect(await un("select nom from public.formateurs where compte_precedent = $1", [FA])).toEqual({ nom: "Fiche de FA" });
  });

  it("plusieurs rôles d'équipe : le plus élevé reste", async () => {
    expect(await roles(AM)).toEqual(["etudiant", "admin"]);
  });

  it("un formateur sans fiche en reçoit une à son nom", async () => {
    expect(await roles(FS)).toEqual(["etudiant", "formateur"]);
    expect((await fiche(FS))?.nom).toBe("Mireille Akpo");
  });
});

describe("Un seul rôle en plus d'étudiant", () => {
  it("la base refuse un second rôle, même inséré directement : jamais formateur et équipe", async () => {
    const C = randomUUID();
    await banc.creerCompte(C, ["formateur"]);
    await expect(banc.db.query("insert into public.roles (profil_id, role) values ($1, 'admin')", [C])).rejects.toThrow(UN_SEUL);
    const D = randomUUID();
    await banc.creerCompte(D, ["moderateur"]);
    await expect(banc.db.query("insert into public.roles (profil_id, role) values ($1, 'admin')", [D])).rejects.toThrow(UN_SEUL);
    await expect(banc.db.query("insert into public.roles (profil_id, role) values ($1, 'formateur')", [D])).rejects.toThrow(UN_SEUL);
  });

  it("changer_role Formateur : sa fiche est créée à son nom, il crée une formation tout de suite ; « Vous êtes formateur »", async () => {
    const C = randomUUID();
    await banc.creerCompte(C);
    await banc.db.query("update public.profils set prenom = 'Koffi', nom = 'Dossou' where id = $1", [C]);
    await changer(S, C, "formateur");
    expect(await roles(C)).toEqual(["etudiant", "formateur"]);
    expect((await fiche(C))?.nom).toBe("Koffi Dossou");
    const [cree] = await banc.en<{ id: string }>({ id: C }, "insert into public.formations (titre, slug) values ('Ma formation', $1) returning id", [`f-${randomUUID()}`]);
    expect(cree.id).toBeTruthy();
    expect(await titres(C)).toEqual(["Vous êtes formateur"]);
  });

  it("formateur puis admin, puis de nouveau formateur : il retrouve sa fiche et ses formations", async () => {
    const C = randomUUID();
    await banc.creerCompte(C);
    await changer(S, C, "formateur");
    const sienne = (await fiche(C))!.id;
    await banc.en({ id: C }, "insert into public.formations (titre, slug) values ('La sienne', $1)", [`f-${randomUUID()}`]);
    await changer(S, C, "admin");
    expect(await roles(C)).toEqual(["etudiant", "admin"]);
    expect(await fiche(C)).toBeUndefined();
    await changer(S, C, "formateur");
    expect((await fiche(C))?.id).toBe(sienne);
    expect(await banc.en({ id: C }, "select titre from public.formations where formateur_id = public.ma_fiche_formateur()")).toEqual([{ titre: "La sienne" }]);
    expect(await un("select count(*)::int as n from public.formateurs where compte_id = $1 or compte_precedent = $1", [C])).toEqual({ n: 1 });
  });

  it("équipe : admin → modérateur sans nouvelle notification ; étudiant → admin : « Vous faites partie de l’équipe » ; retour à étudiant", async () => {
    const C = randomUUID();
    await banc.creerCompte(C);
    await changer(S, C, "admin");
    await changer(S, C, "moderateur");
    expect(await roles(C)).toEqual(["etudiant", "moderateur"]);
    expect(await titres(C)).toEqual(["Vous faites partie de l’équipe"]);
    await changer(S, C, "etudiant");
    expect(await roles(C)).toEqual(["etudiant"]);
  });

  it("le même rôle : rien ne change ; le super admin n'a pas l'espace formateur (pas de fiche)", async () => {
    await changer(S, FS, "formateur");
    expect(await roles(FS)).toEqual(["etudiant", "formateur"]);
    expect(await banc.en({ id: S }, "select public.ma_fiche_formateur() as f")).toEqual([{ f: null }]);
  });

  it("refus : pas super admin ; se retirer super admin ; compte suspendu ; compte introuvable", async () => {
    const C = randomUUID();
    await banc.creerCompte(C);
    await expect(changer(A, C, "formateur")).rejects.toThrow("Seul le super admin change les rôles.");
    await expect(changer(S, S, "admin")).rejects.toThrow("Vous ne pouvez pas vous retirer le rôle super admin.");
    await banc.en({ id: S }, "select public.suspendre_compte($1, '')", [C]);
    await expect(changer(S, C, "formateur")).rejects.toThrow("Réactivez le compte avant de lui donner un rôle.");
    await expect(changer(S, randomUUID(), "formateur")).rejects.toThrow("Compte introuvable.");
  });

  it("l'ancienne fonction changer_roles n'existe plus ; changer_role refusé à un visiteur", async () => {
    await expect(banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [A])).rejects.toThrow(/does not exist/);
    await expect(banc.en("anon", "select public.changer_role($1, 'formateur')", [A])).rejects.toThrow(REFUS);
  });

  it("la migration est rejouable", async () => {
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
    expect(await roles(FS)).toEqual(["etudiant", "formateur"]);
    expect((await fiche(FS))?.nom).toBe("Mireille Akpo");
  });
});
