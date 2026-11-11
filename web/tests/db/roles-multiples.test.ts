import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0079 (ta demande du 11 novembre 2026) : plusieurs rôles pour un compte. Un compte est étudiant, formateur,
// ou les deux, avec au plus un rôle de l'équipe ; le super admin les choisit (changer_roles). « Étudiant » ouvre
// l'espace étudiant, même à un formateur ; un formateur sans « Étudiant » reste sans espace étudiant (règle du
// 20 octobre). Les formateurs d'avant la 0079 gardent cette règle : ils perdent la ligne « étudiant ».

const MIGRATION = join(process.cwd(), "supabase/migrations/0079_plusieurs_roles.sql");
let banc: Banc;
const [SA, ANCIEN, A, B] = Array.from({ length: 4 }, () => randomUUID());
let formation: string;

const roles = async (compte: string) =>
  (await banc.db.query<{ nom: string }>("select role::text as nom from public.roles where profil_id = $1 order by role", [compte])).rows.map((r) => r.nom);
const changer = (qui: string, compte: string, r: string[]) => banc.en({ id: qui }, "select public.changer_roles($1, $2::public.role_etudium[])", [compte, `{${r.join(",")}}`]);
const refus = (p: Promise<unknown>) => p.then(() => "accepté", (e: Error) => e.message);
const sInscrire = (qui: string) => refus(banc.en({ id: qui }, "select public.s_inscrire_formation($1)", [formation]));
const notificationsEquipe = async (compte: string) =>
  Number((await banc.db.query<{ n: number }>("select count(*)::int as n from public.notifications where destinataire = $1 and titre = 'Vous faites partie de l’équipe'", [compte])).rows[0].n);

beforeAll(async () => {
  banc = await creerBanc(["tests/db/realtime-simule.sql", ...migrationsJusqua("0078")]);
  await banc.creerCompte(SA, ["super_admin"]);
  for (const c of [ANCIEN, A, B]) await banc.creerCompte(c);
  // Un formateur d'avant la 0079 (changer_role de la 0017 : il a aussi la ligne « étudiant »).
  await banc.en({ id: SA }, "select public.changer_role($1, 'formateur')", [ANCIEN]);
  formation = (await banc.db.query<{ id: string }>("insert into public.formations (slug, titre, statut, publiee_le, gratuite) values ('gratuite', 'Gratuite', 'publiee', now(), true) returning id")).rows[0].id;
  await banc.db.exec(readFileSync(MIGRATION, "utf8"));
}, 180_000);

describe("Ce que les rôles ouvrent", () => {
  it("un visiteur garde les aperçus ; un formateur étudiant ne s'inscrit pas à sa propre formation", async () => {
    const module = (await banc.db.query<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [formation])).rows[0].id;
    const lecon = (await banc.db.query<{ id: string }>("insert into public.lecons (module_id, titre, apercu, publiee) values ($1, 'Aperçu', true, true) returning id", [module])).rows[0].id;
    expect((await banc.en<{ r: boolean }>("anon", "select public.acces_lecon($1) as r", [lecon]))[0].r).toBe(true);
    // Le formateur de la formation, aussi étudiant : il ne s'y inscrit pas.
    const C = randomUUID();
    await banc.creerCompte(C);
    await changer(SA, C, ["etudiant", "formateur"]);
    await banc.db.query("update public.formations set formateur_id = (select id from public.formateurs where compte_id = $1) where id = $2", [C, formation]);
    expect(await sInscrire(C)).toBe("Vous êtes le formateur de cette formation.");
    await banc.db.query("update public.formations set formateur_id = null where id = $1", [formation]);
  });

  it("un formateur étudiant inscrit à la formation d'un autre est prévenu de sa désactivation ; le journal note « Étudiant »", async () => {
    const D = randomUUID();
    await banc.creerCompte(D);
    await changer(SA, D, ["etudiant", "formateur"]);
    expect(await sInscrire(D)).toBe("accepté");
    const suiveurs = (await banc.db.query<{ s: string[] }>("select public.suiveurs_actifs_formation($1) as s", [formation])).rows[0].s;
    expect(suiveurs).toContain(D);
    await changer(SA, D, ["formateur"]);
    const journal = (await banc.db.query<{ n: number }>("select count(*)::int as n from public.journal_actions where cible_id = $1 and action = 'role_retire'", [D])).rows[0].n;
    expect(journal).toBe(1);
  });

  it("un seul rôle de l'équipe, garanti par la base ; plus d'écriture directe des rôles par l'API", async () => {
    expect(await refus(banc.db.query("insert into public.roles (profil_id, role) values ($1, 'admin'), ($1, 'moderateur')", [B]))).toMatch(/roles_une_equipe/);
    expect(await refus(banc.en({ id: SA }, "delete from public.roles where profil_id = $1", [B]))).toMatch(/permission denied/);
  });
});

describe("Les formateurs d'avant la 0079", () => {
  it("gardent la règle du 20 octobre : formateur, sans espace étudiant", async () => {
    expect(await roles(ANCIEN)).toEqual(["formateur"]);
    expect(await sInscrire(ANCIEN)).toBe("Un compte formateur ne suit pas de formation.");
  });
});

describe("Plusieurs rôles", () => {
  it("formateur et étudiant : sa fiche formateur, et il suit les formations des autres", async () => {
    await changer(SA, A, ["etudiant", "formateur"]);
    expect(await roles(A)).toEqual(["etudiant", "formateur"]);
    expect(Number((await banc.db.query<{ n: number }>("select count(*)::int as n from public.formateurs where compte_id = $1", [A])).rows[0].n)).toBe(1);
    expect(await sInscrire(A)).toBe("accepté");
    // Sans « Étudiant » : formateur seul, sans espace étudiant ; sa fiche reste à lui.
    await changer(SA, A, ["formateur"]);
    expect(await roles(A)).toEqual(["formateur"]);
    expect(await sInscrire(A)).toBe("Un compte formateur ne suit pas de formation.");
  });

  it("formateur et un rôle de l'équipe ; passer d'admin à modérateur ne renvoie pas « Vous faites partie de l’équipe »", async () => {
    await changer(SA, B, ["etudiant", "formateur", "admin"]);
    expect(await roles(B)).toEqual(["etudiant", "formateur", "admin"]);
    expect(await notificationsEquipe(B)).toBe(1);
    await changer(SA, B, ["etudiant", "formateur", "moderateur"]);
    expect(await roles(B)).toEqual(["etudiant", "formateur", "moderateur"]);
    expect(await notificationsEquipe(B)).toBe(1);
    // Retirer Formateur : la fiche est détachée (gardée pour la lui rendre).
    await changer(SA, B, ["etudiant", "moderateur"]);
    expect(Number((await banc.db.query<{ n: number }>("select count(*)::int as n from public.formateurs where compte_precedent = $1", [B])).rows[0].n)).toBe(1);
  });

  it("refuse : ni étudiant ni formateur, deux rôles de l'équipe, se retirer super admin, un autre que le super admin", async () => {
    expect(await refus(changer(SA, B, ["admin"]))).toBe("Un compte est étudiant, formateur, ou les deux.");
    expect(await refus(changer(SA, B, ["etudiant", "admin", "moderateur"]))).toBe("Un seul rôle de l’équipe à la fois.");
    expect(await refus(changer(SA, SA, ["etudiant"]))).toBe("Vous ne pouvez pas vous retirer le rôle super admin.");
    expect(await refus(changer(B, A, ["etudiant"]))).toBe("Seul le super admin change les rôles.");
  });

  it("l'ancienne fonction d'un seul rôle marche encore : formateur seul, ou étudiant avec un rôle de l'équipe", async () => {
    await banc.en({ id: SA }, "select public.changer_role($1, 'formateur')", [B]);
    expect(await roles(B)).toEqual(["formateur"]);
    await banc.en({ id: SA }, "select public.changer_role($1, 'admin')", [B]);
    expect(await roles(B)).toEqual(["etudiant", "admin"]);
  });
});
