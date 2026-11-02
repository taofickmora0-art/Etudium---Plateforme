import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0059 : désactiver une formation (lot 5, étape C). Plus aucun accès étudiant, tout de suite ; la formation
// reste dans « Mes formations » ; ceux qui la suivent sont prévenus (appli, push, e-mail). L'équipe seule désactive et
// réactive ; la réactivation remet la formation « Publiée » et prévient de la même façon.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const E = randomUUID(); // étudiante qui a commencé la formation
const P = randomUUID(); // étudiant suspendu qui l'avait commencée
const X = randomUUID(); // étudiant qui ne la suit pas
let FORMATION: string;
let SLUG: string;
let L1: string;
let BROUILLON: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const statut = (qui: string, valeur: string, formation = FORMATION) =>
  banc.en({ id: qui }, "update public.formations set statut = $2::text::public.statut_formation where id = $1", [formation, valeur]);
const notifications = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string }>("select titre, texte, lien from public.notifications where destinataire = $1 order by id", [qui])).rows;
const emails = async () =>
  (await banc.db.query<{ destinataire: string; titre: string }>("select destinataire, titre from public.envois where canal = 'email' order by id")).rows;
const acces = async (qui: string) => (await banc.en<{ a: boolean }>({ id: qui }, "select public.acces_lecon($1) as a", [L1]))[0].a;

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0059"));
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E, []], [P, []], [X, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  SLUG = `excel-${randomUUID().slice(0, 8)}`;
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Maîtriser Microsoft Excel', $1, $2) returning id", [SLUG, fiche])).id;
  BROUILLON = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Brouillon', $1, $2) returning id", [randomUUID(), fiche])).id;
  const idModule = (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 1', 1) returning id", [FORMATION])).id;
  L1 = (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, 'Les tableaux', 'lecon', true, 1) returning id", [idModule])).id;
  await banc.db.query("insert into public.lecons_contenus (lecon_id, texte) values ($1, 'Texte')", [L1]);
  await statut(S, "publiee");
  for (const qui of [E, P, X]) await abonner(banc, qui);
  for (const qui of [E, P, S]) await banc.en({ id: qui }, "select public.ouvrir_lecon($1)", [L1]);
  await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [P, S]);
  await banc.db.query("delete from public.notifications");
  await banc.db.query("delete from public.envois");
});

describe("Migration 0059 : désactiver une formation", () => {
  it("le nombre d'étudiants qui la suivent (comptes suspendus et équipe exclus, relecture 3) : pour l'équipe seulement", async () => {
    expect((await banc.en<{ n: number }>({ id: S }, "select public.nombre_suiveurs_formation($1) as n", [FORMATION]))[0].n).toBe(1);
    await expect(banc.en({ id: F }, "select public.nombre_suiveurs_formation($1)", [FORMATION])).rejects.toThrow();
    await expect(banc.en({ id: E }, "select public.nombre_suiveurs_formation($1)", [FORMATION])).rejects.toThrow();
    // Point reporté : un visiteur sans compte n'a même pas le droit d'appeler la fonction.
    await expect(banc.en("anon", "select public.nombre_suiveurs_formation($1)", [FORMATION])).rejects.toThrow(/permission denied/);
  });

  it("Review Focus 2 et 3 : le formateur ne change pas l'état ; un brouillon ne se désactive pas", async () => {
    await expect(statut(F, "desactivee")).rejects.toThrow();
    await expect(statut(S, "desactivee", BROUILLON)).rejects.toThrow("Seule une formation publiée peut être désactivée.");
    expect((await un<{ s: string }>("select statut::text as s from public.formations where id = $1", [FORMATION])).s).toBe("publiee");
  });

  it("Review Focus 1 : désactivée, plus d'accès ; elle reste lisible par qui l'a commencée ; étudiants, formateur et e-mails prévenus", async () => {
    expect(await acces(E)).toBe(true);
    await statut(S, "desactivee");
    expect(await acces(E)).toBe(false);
    await expect(banc.en({ id: E }, "select public.ouvrir_lecon($1)", [L1])).rejects.toThrow();
    expect((await banc.en<{ statut: string }>({ id: E }, "select statut::text as statut from public.formations where id = $1", [FORMATION]))[0]?.statut).toBe("desactivee");
    expect(await banc.en({ id: X }, "select 1 from public.formations where id = $1", [FORMATION])).toEqual([]);

    expect(await notifications(E)).toEqual([
      { titre: "« Maîtriser Microsoft Excel » est momentanément indisponible", texte: "Votre progression et vos certificats sont conservés.", lien: "/mes-formations" },
    ]);
    expect(await notifications(X)).toEqual([]);
    expect(await notifications(S)).toEqual([]);
    expect((await notifications(F)).map((n) => n.titre)).toEqual(["Votre formation « Maîtriser Microsoft Excel » est désactivée par l’équipe"]);
    expect(await emails()).toEqual([{ destinataire: E, titre: "« Maîtriser Microsoft Excel » est momentanément indisponible" }]);
  });

  it("points reportés : le formateur ne réactive pas sa formation ; une formation archivée ne se désactive pas", async () => {
    await expect(statut(F, "publiee")).rejects.toThrow();
    expect((await un<{ s: string }>("select statut::text as s from public.formations where id = $1", [FORMATION])).s).toBe("desactivee");
    const archivee = (await un<{ id: string }>("insert into public.formations (titre, slug, statut) values ('Archivée', $1, 'publiee') returning id", [randomUUID()])).id;
    await statut(S, "archivee", archivee);
    await expect(statut(S, "desactivee", archivee)).rejects.toThrow("Seule une formation publiée peut être désactivée.");
  });

  it("Review Focus 3 et 5 : désactivée, elle ne redevient pas brouillon ; les certificats délivrés restent vérifiables", async () => {
    await expect(statut(S, "brouillon")).rejects.toThrow("Une formation désactivée se réactive (elle redevient publiée) ou s’archive.");
    await banc.db.query(
      "insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, delivre_le) values ('ET-2026-TEST-0059', $1, $2, 'Aïcha', 'Maîtriser Microsoft Excel', current_date)",
      [E, FORMATION],
    );
    expect(await banc.en<{ c: unknown }>("anon", "select public.verifier_certificat('ET-2026-TEST-0059') as c")).not.toEqual([{ c: null }]);
  });

  it("Review Focus 4 : réactivée, l'accès revient ; prévenus de la même façon ; ni « Nouvelle formation », ni version en plus", async () => {
    await banc.db.query("delete from public.notifications");
    await banc.db.query("delete from public.envois");
    const avant = (await un<{ n: number }>("select count(*)::int as n from public.versions_formations where formation_id = $1", [FORMATION])).n;
    await statut(S, "publiee");
    expect(await acces(E)).toBe(true);
    expect(await notifications(E)).toEqual([
      { titre: "« Maîtriser Microsoft Excel » est de nouveau disponible", texte: "Elle est de nouveau dans le catalogue.", lien: `/formations/${SLUG}` },
    ]);
    expect(await notifications(X)).toEqual([]);
    expect((await notifications(F)).map((n) => n.titre)).toEqual(["Votre formation « Maîtriser Microsoft Excel » est de nouveau en ligne"]);
    expect(await emails()).toEqual([{ destinataire: E, titre: "« Maîtriser Microsoft Excel » est de nouveau disponible" }]);
    expect((await un<{ n: number }>("select count(*)::int as n from public.versions_formations where formation_id = $1", [FORMATION])).n).toBe(avant);
  });

  it("relecture (1) : désactivée, elle s'archive directement ; personne n'apprend qu'elle serait « de nouveau disponible »", async () => {
    await statut(S, "desactivee");
    await banc.db.query("delete from public.notifications");
    await banc.db.query("delete from public.envois");
    await statut(S, "archivee");
    expect((await un<{ s: string }>("select statut::text as s from public.formations where id = $1", [FORMATION])).s).toBe("archivee");
    expect((await notifications(E)).map((n) => n.titre)).toEqual(["Formation archivée"]);
    expect(await emails()).toEqual([]);
  });
});
