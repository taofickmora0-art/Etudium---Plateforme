import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0060 : les domaines du back-office par rôle (lot 6 A, spec §1). Le modérateur ne gère que la communauté ;
// l'admin tout sauf les rôles et le journal ; le super admin tout. Un compte suspendu n'a plus aucun domaine.

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
const M = randomUUID(); // modérateur
const E = randomUUID(); // étudiant
const AS = randomUUID(); // admin suspendu
let LECON: string;

const appel = (qui: string, sql: string, params: unknown[] = []) => banc.en({ id: qui } as Qui, sql, params);
const refuse = (qui: string, sql: string, params: unknown[] = []) => expect(appel(qui, sql, params)).rejects.toThrow();

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0060"));
  await banc.creerCompte(S, ["super_admin"]);
  for (const id of [A, M, E, AS]) await banc.creerCompte(id);
  for (const [id, role] of [[A, "admin"], [M, "moderateur"], [AS, "admin"]] as const) {
    await banc.en({ id: S }, "select public.changer_role($1, $2)", [id, role]);
  }
  await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [AS, S]);
  const formation = (await banc.db.query<{ id: string }>("insert into public.formations (titre, slug, statut) values ('Excel', $1, 'publiee') returning id", [randomUUID()])).rows[0].id;
  const idModule = (await banc.db.query<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'M', 1) returning id", [formation])).rows[0].id;
  LECON = (await banc.db.query<{ id: string }>("insert into public.lecons (module_id, titre, ordre) values ($1, 'L', 1) returning id", [idModule])).rows[0].id;
});

describe("Migration 0060 : les domaines du back-office", () => {
  it("les domaines de chaque rôle", async () => {
    const domaines = async (role: string) => (await banc.db.query<{ d: string[] }>("select public.domaines_role($1) as d", [role])).rows[0].d;
    expect(await domaines("etudiant")).toEqual([]);
    expect(await domaines("formateur")).toEqual([]);
    expect(await domaines("moderateur")).toEqual(["communaute"]);
    expect(await domaines("admin")).toEqual(["communaute", "contenus", "utilisateurs", "paiements", "statistiques"]);
    expect(await domaines("super_admin")).toEqual(["communaute", "contenus", "utilisateurs", "paiements", "statistiques", "roles", "journal"]);
  });

  it("le modérateur gère la communauté : modération, avis, sessions, assistance, espaces", async () => {
    await appel(M, "select public.nombre_a_examiner()");
    await appel(M, "select public.file_moderation('a_examiner')");
    await appel(M, "select public.avis_equipe()");
    await appel(M, "select public.sessions_equipe()");
    await appel(M, "select public.mes_conversations('equipe')");
    const espaces = (await appel(M, "select public.espaces_communaute() as e")) as { e: unknown[] }[];
    expect(espaces[0].e.length).toBeGreaterThan(0);
  });

  it("le modérateur n'a ni les contenus, ni les comptes, ni les paiements, ni les statistiques, ni les rôles", async () => {
    await refuse(M, "insert into public.formations (titre, slug) values ('Interdite', $1)", [randomUUID()]);
    await refuse(M, "select public.paiements_equipe('tous', '', 1)");
    await refuse(M, "select public.resume_paiements()");
    await refuse(M, "select public.comptes_equipe('', 'tous', 1)");
    await refuse(M, "select public.statistiques_back_office()");
    await refuse(M, "select public.changer_role($1, 'formateur')", [E]);
    expect(((await appel(M, "select public.acces_lecon($1) as a", [LECON])) as { a: boolean }[])[0].a).toBe(false);
  });

  it("l'admin a tout sauf les rôles ; le super admin a tout", async () => {
    await appel(A, "insert into public.formations (titre, slug) values ('Permise', $1)", [randomUUID()]);
    await appel(A, "select public.paiements_equipe('tous', '', 1)");
    await appel(A, "select public.comptes_equipe('', 'tous', 1)");
    await appel(A, "select public.nombre_a_examiner()");
    await refuse(A, "select public.changer_role($1, 'formateur')", [E]);
    await appel(S, "select public.statistiques_back_office()");
  });

  it("Review Focus 5 : un admin suspendu n'a plus aucun domaine ; un étudiant non plus", async () => {
    await refuse(AS, "select public.nombre_a_examiner()");
    await refuse(AS, "select public.paiements_equipe('tous', '', 1)");
    await refuse(AS, "insert into public.formations (titre, slug) values ('Suspendu', $1)", [randomUUID()]);
    await refuse(E, "select public.nombre_a_examiner()");
    expect(((await appel(AS, "select public.a_domaine('communaute') as a")) as { a: boolean }[])[0].a).toBe(false);
  });
});
