import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0061 : renommer et supprimer un compte depuis le back-office (lot 6 A, spec §3). Un admin renomme (un
// membre de l'équipe : le super admin seul) ; le super admin seul supprime, jamais lui-même ni un autre super admin.
// Les paiements et les certificats déjà délivrés restent ; l'action reste au journal.

let banc: Banc;
const S = randomUUID(); // super admin
const S2 = randomUUID(); // autre super admin
const A = randomUUID(); // admin
const M = randomUUID(); // modérateur
const E = randomUUID(); // étudiante abonnée, avec un certificat

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const en = (qui: string, sql: string, params: unknown[] = []) => banc.en({ id: qui } as Qui, sql, params);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0061"));
  for (const id of [S, S2]) await banc.creerCompte(id, ["super_admin"]);
  for (const id of [A, M, E]) await banc.creerCompte(id);
  await en(S, "select public.changer_role($1, 'admin')", [A]);
  await en(S, "select public.changer_role($1, 'moderateur')", [M]);
  await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'Agossou' where id = $1", [E]);
  await banc.db.query("update public.profils set prenom = 'Gildas', nom = 'Tossou' where id = $1", [M]);
});

describe("Renommer un compte", () => {
  it("l'admin renomme un étudiant ; la ligne du journal est écrite", async () => {
    await en(A, "select public.renommer_compte($1, '  Fifamè ', 'Houéto')", [E]);
    expect(await un("select prenom, nom from public.profils where id = $1", [E])).toEqual({ prenom: "Fifamè", nom: "Houéto" });
    expect((await un<{ resume: string }>("select resume from public.journal_actions order by id desc limit 1")).resume).toBe(
      "Compte de Fifamè Agossou renommé en Fifamè Houéto",
    );
  });

  it("un membre de l'équipe : le super admin seul ; des valeurs vides ou trop longues sont refusées ; le modérateur n'a pas ce droit", async () => {
    await expect(en(A, "select public.renommer_compte($1, 'Gildas', 'T.')", [M])).rejects.toThrow("Seul le super admin renomme un membre de l’équipe.");
    await en(S, "select public.renommer_compte($1, 'Gildas', 'T.')", [M]);
    await expect(en(A, "select public.renommer_compte($1, ' ', 'Houéto')", [E])).rejects.toThrow("Écrivez le prénom et le nom (60 caractères au plus).");
    await expect(en(A, "select public.renommer_compte($1, $2, 'Houéto')", [E, "x".repeat(61)])).rejects.toThrow("Écrivez le prénom et le nom (60 caractères au plus).");
    await expect(en(M, "select public.renommer_compte($1, 'Fifamè', 'X')", [E])).rejects.toThrow();
  });
});

describe("Supprimer un compte", () => {
  it("Review Focus 2 : jamais soi-même, jamais un autre super admin ; l'admin ne supprime pas ; le motif est demandé", async () => {
    await expect(en(S, "select public.supprimer_compte($1, 'Test')", [S])).rejects.toThrow("Vous ne pouvez pas supprimer votre propre compte d’ici : passez par votre profil.");
    await expect(en(S, "select public.supprimer_compte($1, 'Test')", [S2])).rejects.toThrow("Un compte super admin ne se supprime pas.");
    await expect(en(A, "select public.supprimer_compte($1, 'Test')", [E])).rejects.toThrow();
    await expect(en(S, "select public.supprimer_compte($1, '  ')", [E])).rejects.toThrow("Indiquez le motif de la suppression.");
    await expect(en(A, "select public.fichiers_du_compte($1)", [E])).rejects.toThrow();
  });

  it("le super admin supprime une étudiante qui a payé et a un certificat : le paiement et le certificat restent, le journal aussi", async () => {
    await abonner(banc, E);
    const formation = (await un<{ id: string }>("insert into public.formations (titre, slug) values ('Excel', $1) returning id", [randomUUID()])).id;
    await banc.db.query(
      "insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, delivre_le) values ('ET-2026-AB12-CD34', $1, $2, 'Fifamè Houéto', 'Excel', current_date)",
      [E, formation],
    );
    const fichiers = ((await en(S, "select public.fichiers_du_compte($1) as f", [E])) as { f: { photos: string[]; rendus: string[]; messages: string[] } }[])[0].f;
    expect(fichiers).toEqual({ photos: [], rendus: [], messages: [] });
    const email = (await un<{ email: string }>("select email from auth.users where id = $1", [E])).email;

    await en(S, "select public.supprimer_compte($1, 'Demande de la personne')", [E]);

    expect((await banc.db.query("select 1 from public.profils where id = $1", [E])).rows).toHaveLength(0);
    expect((await banc.db.query("select 1 from public.paiements where profil_id is null")).rows.length).toBeGreaterThan(0);
    const verifie = ((await banc.en<{ c: { identifiant: string } | null }>("anon", "select public.verifier_certificat('ET-2026-AB12-CD34') as c")))[0].c;
    expect(verifie?.identifiant).toBe("ET-2026-AB12-CD34");
    const ligne = await un<{ resume: string; auteur: string; details: { motif: string } }>(
      "select resume, auteur, details from public.journal_actions where action = 'compte_supprime'",
    );
    expect(ligne).toMatchObject({ resume: `Compte de Fifamè Houéto (${email}) supprimé`, auteur: S, details: { motif: "Demande de la personne" } });
  });
});
