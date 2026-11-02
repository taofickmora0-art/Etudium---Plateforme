import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0057 : l'historique des versions d'une formation (fin du lot 4, spec §3). Une version (numéro, date, auteur,
// résumé, instantané) à la mise en ligne, à chaque « Publier les modifications », et quand une leçon est publiée ou
// retirée d'une formation en ligne. Restaurer remet le contenu d'une version dans les brouillons (ou directement, pour ce
// que les étudiants ne voient pas) ; une leçon supprimée depuis revient, non publiée.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiante abonnée
let FORMATION: string;
let MODULE: string;
let L1: string;
let L2: string;
let QUIZ: string;
let MODULE2: string;
let L3: string;

type Version = { id: string; numero: number; cree_le: string; auteur: string | null; resume: string; en_ligne: boolean };
type Enregistrement = { etat: string; revision: number; brouillon: boolean; par?: string | null };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const versions = (qui: string = S) => rpc<Version[]>({ id: qui }, "select public.versions_formation($1) as r", [FORMATION]);
const restaurer = (qui: string, version: string) =>
  rpc<{ numero: number; infos: boolean; lecons_modifiees: number; lecons_recreees: number }>({ id: qui }, "select public.restaurer_version($1) as r", [version]);
const edition = (qui: string, lecon: string) => rpc<{ revision: number; brouillon: boolean; donnees: Record<string, unknown> }>({ id: qui }, "select public.edition_lecon($1) as r", [lecon]);
const enregistrer = (qui: string, lecon: string, titre: string, texte: string, revision: number) =>
  rpc<Enregistrement>({ id: qui }, "select public.enregistrer_lecon($1, $2::jsonb, $3) as r", [
    lecon,
    JSON.stringify({ titre, resume: "", points_cles: [], duree_secondes: 0, texte, document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: texte }] }] } }),
    revision,
  ]);
const publier = (qui: string) => rpc<{ publiees: number; version: number | null }>({ id: qui }, "select public.publier_modifications($1) as r", [FORMATION]);
const vu = async (lecon: string) => (await banc.en<{ titre: string; texte: string }>({ id: E }, "select l.titre, c.texte from public.lecons l join public.lecons_contenus c on c.lecon_id = l.id where l.id = $1", [lecon]))[0];

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0057"));
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [S]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Adjovi' where id = $1", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Excel', $1, $2) returning id", [randomUUID(), fiche])).id;
  MODULE = (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 1', 1) returning id", [FORMATION])).id;
  MODULE2 = (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 2', 2) returning id", [FORMATION])).id;
  const lecon = async (module: string, titre: string, type: string, publiee: boolean, ordre: number) => {
    const id = (await un<{ id: string }>("insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, $2, $3, $4, $5) returning id", [module, titre, type, publiee, ordre])).id;
    await banc.db.query("insert into public.lecons_contenus (lecon_id, texte) values ($1, $2)", [id, `Texte de ${titre}`]);
    return id;
  };
  L1 = await lecon(MODULE, "Les tableaux", "lecon", true, 1);
  L2 = await lecon(MODULE, "Les graphiques", "lecon", true, 2);
  QUIZ = await lecon(MODULE, "Quiz du module 1", "quiz", false, 3);
  L3 = await lecon(MODULE2, "Les macros", "lecon", true, 1);
  await abonner(banc, E);
});

describe("Migration 0057 : l'historique des versions", () => {
  it("mise en ligne : version 1 « Mise en ligne », par qui l'a publiée", async () => {
    await banc.en({ id: S }, "update public.formations set statut = 'publiee' where id = $1", [FORMATION]);
    expect(await versions()).toMatchObject([{ numero: 1, resume: "Mise en ligne", auteur: "Aïcha Kpadé", en_ligne: true }]);
    const instantane = (await un<{ contenu: { infos: { titre: string }; modules: { titre: string; lecons: { id: string; titre: string; publiee: boolean }[] }[] } }>(
      "select contenu from public.versions_formations where formation_id = $1 and numero = 1",
      [FORMATION],
    )).contenu;
    expect(instantane.infos.titre).toBe("Excel");
    expect(instantane.modules.map((m) => m.titre)).toEqual(["Module 1", "Module 2"]);
    expect(instantane.modules[0].lecons.map((l) => [l.titre, l.publiee])).toEqual([
      ["Les tableaux", true],
      ["Les graphiques", true],
      ["Quiz du module 1", false],
    ]);
  });

  it("publier des modifications : version 2, avec son résumé et son auteur ; le numéro est rendu", async () => {
    const r = (await edition(F, L1)).revision;
    await enregistrer(F, L1, "Les tableaux croisés", "Version 2", r);
    await rpc({ id: F }, "select public.enregistrer_infos_formation($1, $2::jsonb, 0) as r", [
      FORMATION,
      JSON.stringify({ titre: "Excel pour tous", resume: "", description: "", objectifs: [], competences: [], niveau: "debutant" }),
    ]);
    expect(await publier(F)).toEqual({ publiees: 2, version: 2 });
    expect((await versions())[0]).toMatchObject({ numero: 2, resume: "Informations générales et 1 leçon modifiées", auteur: "Mireille Adjovi", en_ligne: true });
    const r2 = (await edition(F, L2)).revision;
    await enregistrer(F, L2, "Les graphiques (2)", "Graphiques 2", r2);
    expect(await publier(F)).toEqual({ publiees: 1, version: 3 });
    expect((await versions())[0]).toMatchObject({ numero: 3, resume: "Leçon « Les graphiques (2) » modifiée" });
  });

  it("retirer puis publier une leçon d'une formation en ligne : une version chaque fois", async () => {
    await banc.en({ id: F }, "update public.lecons set publiee = false where id = $1", [L3]);
    await banc.en({ id: F }, "update public.lecons set publiee = true where id = $1", [L3]);
    expect((await versions()).slice(0, 2).map((v) => [v.numero, v.resume])).toEqual([
      [5, "Leçon « Les macros » mise en ligne"],
      [4, "Leçon « Les macros » retirée"],
    ]);
  });

  it("la liste : la plus récente d'abord, seule « en ligne » ; un auteur supprimé n'a plus de nom", async () => {
    const liste = await versions(F);
    expect(liste.map((v) => v.numero)).toEqual([5, 4, 3, 2, 1]);
    expect(liste.map((v) => v.en_ligne)).toEqual([true, false, false, false, false]);
    await banc.db.query("update public.versions_formations set auteur_id = null where formation_id = $1 and numero = 1", [FORMATION]);
    expect((await versions()).at(-1)).toMatchObject({ numero: 1, auteur: null });
  });

  it("restaurer : les brouillons se remplissent, l'étudiant ne voit rien changer, puis publier remet l'ancienne version", async () => {
    const v1 = (await versions()).find((v) => v.numero === 1)!;
    expect(await restaurer(F, v1.id)).toEqual({ numero: 1, infos: true, lecons_modifiees: 2, lecons_recreees: 0, en_ligne: true });
    expect(await vu(L1)).toEqual({ titre: "Les tableaux croisés", texte: "Version 2" });
    expect(await edition(F, L1)).toMatchObject({ brouillon: true, donnees: { titre: "Les tableaux", texte: "Texte de Les tableaux" } });
    expect(await rpc({ id: F }, "select public.edition_formation($1) as r", [FORMATION])).toMatchObject({ brouillon: true, donnees: { titre: "Excel" } });
    expect(await publier(S)).toMatchObject({ publiees: 3, version: 6 });
    expect(await vu(L1)).toEqual({ titre: "Les tableaux", texte: "Texte de Les tableaux" });
    expect(await un("select titre from public.formations where id = $1", [FORMATION])).toEqual({ titre: "Excel" });
  });

  it("restaurer une leçon supprimée depuis : recréée non publiée ; un quiz revient sans questions ; un module disparu est recréé", async () => {
    const v6 = (await versions()).find((v) => v.numero === 6)!;
    await banc.en({ id: F }, "delete from public.lecons where id = any($1::uuid[])", [[L2, QUIZ]]);
    await banc.en({ id: F }, "delete from public.modules where id = $1", [MODULE2]);
    expect(await restaurer(F, v6.id)).toEqual({ numero: 6, infos: false, lecons_modifiees: 0, lecons_recreees: 3, en_ligne: true });
    const recreees = (await banc.db.query<{ titre: string; type: string; publiee: boolean; module: string; texte: string }>(
      `select l.titre, l.type, l.publiee, m.titre as module, c.texte
       from public.lecons l join public.modules m on m.id = l.module_id left join public.lecons_contenus c on c.lecon_id = l.id
       where m.formation_id = $1 and l.id <> $2 order by m.ordre, l.ordre`,
      [FORMATION, L1],
    )).rows;
    expect(recreees).toEqual([
      { titre: "Les graphiques", type: "lecon", publiee: false, module: "Module 1", texte: "Texte de Les graphiques" },
      { titre: "Quiz du module 1", type: "quiz", publiee: false, module: "Module 1", texte: "Texte de Quiz du module 1" },
      { titre: "Les macros", type: "lecon", publiee: false, module: "Module 2", texte: "Texte de Les macros" },
    ]);
    expect(await un("select count(*)::int as n from public.questions_quiz q join public.lecons l on l.id = q.lecon_id where l.titre = 'Quiz du module 1'")).toEqual({ n: 0 });
  });

  it("restaurer pendant qu'un brouillon existe : remplacé, révision augmentée (un éditeur ouvert est en conflit)", async () => {
    const r = (await edition(F, L1)).revision;
    const brouillon = await enregistrer(F, L1, "Mon brouillon", "En cours", r);
    expect(brouillon).toMatchObject({ etat: "enregistre", brouillon: true });
    const v3 = (await versions()).find((v) => v.numero === 3)!;
    await restaurer(S, v3.id);
    expect(await edition(F, L1)).toMatchObject({ brouillon: true, revision: brouillon.revision + 1, donnees: { titre: "Les tableaux croisés" } });
    expect(await enregistrer(F, L1, "Mon brouillon (suite)", "En cours", brouillon.revision)).toMatchObject({ etat: "conflit", par: "Aïcha Kpadé" });
  });

  it("droits : un étudiant et un autre formateur ne lisent ni ne restaurent l'historique", async () => {
    const v1 = (await versions()).find((v) => v.numero === 1)!;
    for (const qui of [E, G]) {
      await expect(versions(qui)).rejects.toThrow(/Vous ne pouvez pas modifier cette formation/);
      await expect(restaurer(qui, v1.id)).rejects.toThrow(/Vous ne pouvez pas modifier cette formation/);
    }
    expect(await banc.en({ id: E }, "select id from public.versions_formations")).toEqual([]);
  });

  it("relecture (5) : une leçon supprimée revient même si une autre leçon porte le même titre ; une seconde restauration ne la double pas", async () => {
    const m3 = (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 3', 10) returning id", [FORMATION])).id;
    const m4 = (await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 4', 11) returning id", [FORMATION])).id;
    for (const m of [m3, m4]) {
      const id = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, ordre) values ($1, 'Introduction', false, 1) returning id", [m])).id;
      await banc.db.query("insert into public.lecons_contenus (lecon_id, texte) values ($1, 'Intro')", [id]);
    }
    const intro4 = (await un<{ id: string }>("select id from public.lecons where module_id = $1", [m4])).id;
    // Publier puis retirer l'introduction du module 4 : deux versions, dont la première la contient publiée.
    await banc.en({ id: F }, "update public.lecons set publiee = true where id = $1", [intro4]);
    const avec = (await versions())[0];
    await banc.en({ id: F }, "delete from public.lecons where id = $1", [intro4]);
    const r = await restaurer(F, avec.id);
    expect(r.lecons_recreees).toBe(1);
    expect(await un("select count(*)::int as n from public.lecons where module_id = $1 and titre = 'Introduction'", [m4])).toEqual({ n: 1 });
    // Restaurer encore : la leçon recréée est reconnue, rien n'est doublé.
    expect((await restaurer(F, avec.id)).lecons_recreees).toBe(0);
    expect(await un("select count(*)::int as n from public.lecons where module_id = $1 and titre = 'Introduction'", [m4])).toEqual({ n: 1 });
  });
});
