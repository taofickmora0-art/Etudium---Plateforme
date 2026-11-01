import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0056 : les brouillons et la sauvegarde automatique (fin du lot 4, spec §2). Une leçon visible des
// étudiants (ou qui a déjà un brouillon) s'enregistre dans son brouillon ; sinon directement. Chaque enregistrement
// donne la révision qu'il a vue : une révision dépassée est refusée (conflit). « Publier les modifications » applique
// tous les brouillons d'une formation ; « Abandonner » les efface.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiante abonnée
const M = randomUUID(); // modérateur suspendu
let FORMATION: string;
let MODULE: string;
let EN_LIGNE: string; // leçon publiée d'une formation publiée
let CACHEE: string; // leçon pas encore publiée
let EN_LIGNE_2: string;
let BROUILLON_FORMATION: string; // formation jamais publiée
let LECON_BF: string;

type Edition = { donnees: Record<string, unknown>; revision: number; brouillon: boolean; en_ligne: boolean; modifie_par: string | null };
type Enregistrement = { etat: "enregistre"; revision: number; brouillon: boolean } | { etat: "conflit"; par: string | null };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const donnees = (titre: string, texte = "Bonjour", extra: Record<string, unknown> = {}) => ({
  titre,
  titre_court: null,
  resume: "Résumé",
  points_cles: ["Un", "Deux"],
  video_fournisseur: "youtube",
  video_id: "dQw4w9WgXcQ",
  duree_secondes: 125,
  document: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: texte }] }] },
  texte,
  ...extra,
});
const edition = (qui: string, lecon: string) => rpc<Edition>({ id: qui }, "select public.edition_lecon($1) as r", [lecon]);
const enregistrer = (qui: string, lecon: string, d: unknown, revision: number) =>
  rpc<Enregistrement>({ id: qui }, "select public.enregistrer_lecon($1, $2::jsonb, $3) as r", [lecon, JSON.stringify(d), revision]);
const publier = (qui: string, formation: string) => rpc<{ publiees: number; version: number | null }>({ id: qui }, "select public.publier_modifications($1) as r", [formation]);
const abandonner = (qui: string, formation: string, lecon: string | null = null) =>
  rpc<number>({ id: qui }, "select public.abandonner_modifications($1, $2) as r", [formation, lecon]);
const vu = async (qui: Qui, lecon: string) =>
  (await banc.en<{ titre: string; texte: string }>(qui, "select l.titre, c.texte from public.lecons l join public.lecons_contenus c on c.lecon_id = l.id where l.id = $1", [lecon]))[0];

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0056"));
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []], [M, ["moderateur"]]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Adjovi' where id = $1", [F]);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [S]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  await banc.db.query("insert into public.suspensions (profil_id, par) values ($1, $2)", [M, S]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Excel', $1, $2) returning id", [randomUUID(), fiche])).id;
  MODULE = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [FORMATION])).id;
  const lecon = async (module: string, titre: string, publiee: boolean, ordre: number) => {
    const id = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, ordre) values ($1, $2, $3, $4) returning id", [module, titre, publiee, ordre])).id;
    await banc.db.query("insert into public.lecons_contenus (lecon_id, texte) values ($1, 'Ancien texte')", [id]);
    return id;
  };
  EN_LIGNE = await lecon(MODULE, "Les tableaux", true, 1);
  CACHEE = await lecon(MODULE, "En préparation", false, 2);
  EN_LIGNE_2 = await lecon(MODULE, "Les graphiques", true, 3);
  await banc.db.query("update public.formations set statut = 'publiee', publiee_le = now() where id = $1", [FORMATION]);
  BROUILLON_FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Word', $1, $2) returning id", [randomUUID(), fiche])).id;
  const module2 = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [BROUILLON_FORMATION])).id;
  LECON_BF = await lecon(module2, "Mise en page", true, 1);
  await abonner(banc, E);
});

describe("Migration 0056 : les brouillons", () => {
  it("droits : un étudiant, un formateur d'une autre formation, un compte suspendu sont refusés", async () => {
    for (const qui of [E, G, M]) {
      await expect(edition(qui, EN_LIGNE)).rejects.toThrow(/Vous ne pouvez pas modifier cette leçon/);
      await expect(enregistrer(qui, EN_LIGNE, donnees("Piraté"), 0)).rejects.toThrow(/Vous ne pouvez pas modifier cette leçon/);
      await expect(publier(qui, FORMATION)).rejects.toThrow(/Vous ne pouvez pas modifier cette formation/);
    }
    // Les brouillons ne se lisent pas en direct par un étudiant.
    expect(await banc.en({ id: E }, "select * from public.brouillons_lecons")).toEqual([]);
  });

  it("leçon invisible : enregistrement direct, révision +1", async () => {
    const avant = await edition(F, CACHEE);
    expect(avant).toMatchObject({ brouillon: false, en_ligne: false, revision: 0, donnees: { titre: "En préparation", texte: "Ancien texte", document: null } });
    expect(await enregistrer(F, CACHEE, donnees("En préparation (suite)", "Nouveau"), 0)).toMatchObject({ etat: "enregistre", revision: 1, brouillon: false });
    expect(await vu({ id: S }, CACHEE)).toEqual({ titre: "En préparation (suite)", texte: "Nouveau" });
    expect(await un("select points_cles, duree_secondes from public.lecons where id = $1", [CACHEE])).toEqual({ points_cles: ["Un", "Deux"], duree_secondes: 125 });
    expect(await un("select count(*)::int as n from public.brouillons_lecons where lecon_id = $1", [CACHEE])).toEqual({ n: 0 });
  });

  it("leçon visible : brouillon ; l'étudiant voit toujours l'ancien contenu", async () => {
    expect(await enregistrer(F, EN_LIGNE, donnees("Les tableaux croisés", "Version brouillon"), 0)).toMatchObject({ etat: "enregistre", revision: 1, brouillon: true });
    expect(await vu({ id: E }, EN_LIGNE)).toEqual({ titre: "Les tableaux", texte: "Ancien texte" });
    expect(await edition(F, EN_LIGNE)).toMatchObject({ brouillon: true, en_ligne: true, revision: 1, modifie_par: "Mireille Adjovi", donnees: { titre: "Les tableaux croisés" } });
    // Le brouillon suivant part de la révision rendue.
    expect(await enregistrer(S, EN_LIGNE, donnees("Les tableaux croisés dynamiques", "Version 2"), 1)).toMatchObject({ etat: "enregistre", revision: 2, brouillon: true });
    expect(await banc.en({ id: F }, "select lecon_id from public.brouillons_lecons")).toEqual([{ lecon_id: EN_LIGNE }]);
  });

  it("conflit : une révision dépassée est refusée avec le nom de l'auteur, rien n'est écrasé", async () => {
    expect(await enregistrer(F, EN_LIGNE, donnees("Ma version"), 1)).toEqual({ etat: "conflit", par: "Aïcha Kpadé" });
    expect(await edition(F, EN_LIGNE)).toMatchObject({ revision: 2, donnees: { titre: "Les tableaux croisés dynamiques" } });
  });

  it("modifications en attente : la liste, dans l'ordre du programme", async () => {
    expect(await rpc({ id: F }, "select public.modifications_en_attente($1) as r", [FORMATION])).toMatchObject([
      { type: "lecon", id: EN_LIGNE, titre: "Les tableaux croisés dynamiques", rang: 1, modifie_par: "Aïcha Kpadé" },
    ]);
  });

  it("publier : champs appliqués, brouillons effacés, révisions augmentées, date « modifiée par le formateur »", async () => {
    await banc.db.query("update public.formations set modifiee_par_formateur_le = null where id = $1", [FORMATION]);
    expect(await publier(F, FORMATION)).toEqual({ publiees: 1, version: null });
    expect(await vu({ id: E }, EN_LIGNE)).toEqual({ titre: "Les tableaux croisés dynamiques", texte: "Version 2" });
    expect(await un("select count(*)::int as n from public.brouillons_lecons")).toEqual({ n: 0 });
    expect(await un<{ revision: number }>("select revision from public.lecons where id = $1", [EN_LIGNE])).toEqual({ revision: 3 });
    expect((await un<{ m: string | null }>("select modifiee_par_formateur_le as m from public.formations where id = $1", [FORMATION])).m).not.toBeNull();
    expect(await publier(F, FORMATION)).toEqual({ publiees: 0, version: null });
  });

  it("Review Focus 3 : brouillon publié par un autre, puis sauvegarde avec l'ancienne révision → conflit, aucun brouillon recréé", async () => {
    const r = await enregistrer(F, EN_LIGNE_2, donnees("Les graphiques (F)"), 0);
    expect(r).toMatchObject({ etat: "enregistre", revision: 1, brouillon: true });
    expect(await publier(S, FORMATION)).toMatchObject({ publiees: 1 });
    // L'éditeur de F, resté ouvert, tient encore la révision 1 du brouillon disparu.
    expect(await enregistrer(F, EN_LIGNE_2, donnees("Les graphiques (périmé)"), 1)).toEqual({ etat: "conflit", par: "Aïcha Kpadé" });
    expect(await un("select count(*)::int as n from public.brouillons_lecons where lecon_id = $1", [EN_LIGNE_2])).toEqual({ n: 0 });
  });

  it("le formateur ne publie pas une formation jamais mise en ligne ; il y enregistre directement", async () => {
    expect(await enregistrer(F, LECON_BF, donnees("Mise en page (suite)"), 0)).toMatchObject({ etat: "enregistre", brouillon: false });
    await expect(publier(F, BROUILLON_FORMATION)).rejects.toThrow(/pas encore en ligne/);
  });

  it("abandonner : une leçon, puis toute la formation", async () => {
    const r1 = await edition(F, EN_LIGNE);
    await enregistrer(F, EN_LIGNE, donnees("À abandonner"), r1.revision);
    const r2 = await edition(F, EN_LIGNE_2);
    await enregistrer(F, EN_LIGNE_2, donnees("À abandonner aussi"), r2.revision);
    await rpc({ id: F }, "select public.enregistrer_infos_formation($1, $2::jsonb, 0) as r", [
      FORMATION,
      JSON.stringify({ titre: "Excel (brouillon)", resume: "", description: "", objectifs: [], competences: [], niveau: "debutant" }),
    ]);
    expect(await abandonner(F, FORMATION, EN_LIGNE)).toBe(1);
    expect(await edition(F, EN_LIGNE)).toMatchObject({ brouillon: false, donnees: { titre: "Les tableaux croisés dynamiques" } });
    expect(await abandonner(F, FORMATION)).toBe(2);
    expect(await un("select count(*)::int as n from public.brouillons_lecons")).toEqual({ n: 0 });
    expect(await un("select count(*)::int as n from public.brouillons_formations")).toEqual({ n: 0 });
    await expect(abandonner(G, FORMATION)).rejects.toThrow(/Vous ne pouvez pas modifier cette formation/);
  });

  it("informations générales : brouillon quand la formation est visible ; publiées avec la formation", async () => {
    const avant = await rpc<Edition>({ id: F }, "select public.edition_formation($1) as r", [FORMATION]);
    expect(avant).toMatchObject({ brouillon: false, en_ligne: true, donnees: { titre: "Excel", niveau: "debutant" } });
    const infos = { titre: "Excel pour tous", resume: "Court", description: "Longue", objectifs: ["Calculer"], competences: ["Excel"], niveau: "intermediaire" };
    expect(await rpc({ id: F }, "select public.enregistrer_infos_formation($1, $2::jsonb, $3) as r", [FORMATION, JSON.stringify(infos), avant.revision])).toMatchObject({
      etat: "enregistre",
      brouillon: true,
    });
    expect(await un("select titre from public.formations where id = $1", [FORMATION])).toEqual({ titre: "Excel" });
    expect(await rpc({ id: F }, "select public.modifications_en_attente($1) as r", [FORMATION])).toMatchObject([{ type: "formation", id: FORMATION, titre: "Informations générales" }]);
    expect(await publier(S, FORMATION)).toMatchObject({ publiees: 1 });
    expect(await un("select titre, resume, description, objectifs, competences, niveau from public.formations where id = $1", [FORMATION])).toEqual({ ...infos, niveau: "intermediaire" });
    // Une formation pas encore en ligne : directement.
    const bf = await rpc<Edition>({ id: F }, "select public.edition_formation($1) as r", [BROUILLON_FORMATION]);
    expect(await rpc({ id: F }, "select public.enregistrer_infos_formation($1, $2::jsonb, $3) as r", [BROUILLON_FORMATION, JSON.stringify({ ...infos, titre: "Word" }), bf.revision])).toMatchObject({
      brouillon: false,
    });
  });

  it("données invalides : un message clair", async () => {
    const r = (await edition(F, CACHEE)).revision;
    await expect(enregistrer(F, CACHEE, donnees(""), r)).rejects.toThrow(/Le titre est obligatoire/);
    await expect(enregistrer(F, CACHEE, donnees("x", "a".repeat(20_001)), r)).rejects.toThrow(/20 000 caractères/);
    await expect(enregistrer(F, CACHEE, donnees("x", "a", { resume: "a".repeat(1001) }), r)).rejects.toThrow(/résumé/);
    await expect(enregistrer(F, CACHEE, donnees("x", "a", { video_id: null }), r)).rejects.toThrow(/vidéo/);
    await expect(enregistrer(F, CACHEE, donnees("x", "a", { duree_secondes: -1 }), r)).rejects.toThrow(/durée/);
    await expect(enregistrer(F, CACHEE, donnees("x", "a", { points_cles: Array.from({ length: 21 }, () => "p") }), r)).rejects.toThrow(/20/);
    await expect(
      rpc({ id: F }, "select public.enregistrer_infos_formation($1, $2::jsonb, 0) as r", [BROUILLON_FORMATION, JSON.stringify({ titre: "Word", niveau: "expert" })]),
    ).rejects.toThrow(/niveau/);
  });

  it("relecture (4) : abandonner augmente la révision ; un éditeur resté ouvert sur le brouillon abandonné est en conflit", async () => {
    const r = (await edition(F, EN_LIGNE)).revision;
    const brouillon = await enregistrer(F, EN_LIGNE, donnees("Brouillon de F"), r);
    // L'équipe ouvre le même brouillon…
    const vue = await edition(S, EN_LIGNE);
    expect(vue).toMatchObject({ brouillon: true, revision: (brouillon as { revision: number }).revision });
    // … F l'abandonne, puis repart d'un nouveau brouillon.
    expect(await abandonner(F, FORMATION, EN_LIGNE)).toBe(1);
    const apres = await edition(F, EN_LIGNE);
    expect(apres.revision).toBeGreaterThan(vue.revision);
    await enregistrer(F, EN_LIGNE, donnees("Nouveau travail de F"), apres.revision);
    // L'équipe, restée sur l'ancien brouillon, n'écrase rien.
    expect(await enregistrer(S, EN_LIGNE, donnees("Version périmée"), vue.revision)).toMatchObject({ etat: "conflit" });
    expect(await edition(F, EN_LIGNE)).toMatchObject({ donnees: { titre: "Nouveau travail de F" } });
    await abandonner(F, FORMATION);
  });

  it("relecture (7) : une image d'une autre formation est refusée avec un message clair", async () => {
    const r = (await edition(F, CACHEE)).revision;
    const ailleurs = `${randomUUID()}/${randomUUID()}.webp`;
    const ici = `${FORMATION}/${randomUUID()}.webp`;
    const avecImage = (chemin: string) =>
      donnees("Avec image", "x", { document: { type: "doc", content: [{ type: "imageLecon", attrs: { chemin, alt: "", legende: "" } }] } });
    await expect(enregistrer(F, CACHEE, avecImage(ailleurs), r)).rejects.toThrow(/autre formation/);
    expect(await enregistrer(F, CACHEE, avecImage(ici), r)).toMatchObject({ etat: "enregistre" });
  });
});
