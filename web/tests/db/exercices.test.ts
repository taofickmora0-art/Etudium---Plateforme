import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0032 : les exercices (spec du lot 3, §3). L'étudiant termine un exercice simple ou dépose son travail
// (versions conservées) ; le formateur de la formation, ou l'équipe, valide ou demande une correction.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const F = randomUUID(); // formateur de la formation
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiant
const E2 = randomUUID(); // autre étudiant
let FORMATION: string;
let MODULE: string;
let EXO: string;
let SIMPLE: string;
let LECON: string;
let BROUILLON: string;

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Version = { id: string; version: number; nom_fichier: string; format: string; taille_octets: number; message: string; statut: string; remarque: string; correcteur: string };
type Exercice = { genre: string; statut: string | null; peut_deposer: boolean; versions: Version[] };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const deposer = (qui: string, chemin: string, type = XLSX, taille = 142_000) =>
  banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('rendus', $1, $2, $3::jsonb)", [chemin, qui, JSON.stringify({ mimetype: type, size: taille })]);
const rendre = async (qui: string, lecon: string, chemin: string, nom = "tableau.xlsx", message = "") =>
  (await banc.en<{ r: Version }>({ id: qui }, "select public.rendre_exercice($1, $2, $3, $4) as r", [lecon, chemin, nom, message]))[0].r;
const exercice = async (qui: string, lecon: string) => (await banc.en<{ e: Exercice | null }>({ id: qui }, "select public.exercice_etudiant($1) as e", [lecon]))[0].e;
const corriger = (qui: string, rendu: string, decision: string, remarque: string) =>
  banc.en({ id: qui }, "select public.corriger_rendu($1, $2, $3)", [rendu, decision, remarque]);
const aCorriger = async (qui: string) => (await banc.en<{ c: { rendu_id: string; etudiant: string; exercice: string; version: number }[] }>({ id: qui }, "select public.corrections_a_faire() as c"))[0].c;
const notifications = async (qui: string) => (await banc.db.query<{ titre: string; lien: string }>("select titre, lien from public.notifications where destinataire = $1 order by cree_le", [qui])).rows;
const lit = async (qui: string, chemin: string) => (await banc.en({ id: qui }, "select name from storage.objects where bucket_id = 'rendus' and name = $1", [chemin])).length;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [G, []], [E, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Adjovi' where id = $1", [F]);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [E]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [G]);
  const fiche = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite) values ('Excel', $1, $2, true) returning id", [randomUUID(), fiche])).id;
  MODULE = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 3') returning id", [FORMATION])).id;
  const lecon = async (titre: string, type: string, publiee: boolean, ordre: number, genre?: string) =>
    (
      await un<{ id: string }>(
        genre
          ? "insert into public.lecons (module_id, titre, type, publiee, ordre, genre_exercice) values ($1, $2, $3, $4, $5, $6) returning id"
          : "insert into public.lecons (module_id, titre, type, publiee, ordre) values ($1, $2, $3, $4, $5) returning id",
        genre ? [MODULE, titre, type, publiee, ordre, genre] : [MODULE, titre, type, publiee, ordre],
      )
    ).id;
  LECON = await lecon("Les tableaux croisés", "lecon", true, 1);
  EXO = await lecon("Tableau des ventes", "exercice", true, 2);
  SIMPLE = await lecon("Nettoyer une enquête", "exercice", true, 3, "simple");
  BROUILLON = await lecon("Exercice en préparation", "exercice", false, 4);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [FORMATION]);
});

describe("Migration 0032 : les exercices", () => {
  it("un exercice est « avec rendu » par défaut ; « simple » se choisit ; une leçon n'a pas de genre", async () => {
    const genres = (await banc.db.query<{ id: string; genre_exercice: string | null }>("select id, genre_exercice from public.lecons where module_id = $1", [MODULE])).rows;
    expect(Object.fromEntries(genres.map((l) => [l.id, l.genre_exercice]))).toEqual({ [LECON]: null, [EXO]: "rendu", [SIMPLE]: "simple", [BROUILLON]: "rendu" });
  });

  it("l'étudiant dépose son travail : version 1 en attente, le formateur est notifié ; un second dépôt attend la correction", async () => {
    const chemin = `${E}/${EXO}/v1.xlsx`;
    await deposer(E, chemin);
    expect(await rendre(E, EXO, chemin, "Tableau_ventes.xlsx", "J’ai ajouté le filtre.")).toMatchObject({ version: 1, statut: "en_attente" });
    expect(await exercice(E, EXO)).toMatchObject({
      genre: "rendu",
      statut: "en_attente",
      peut_deposer: false,
      versions: [{ version: 1, nom_fichier: "Tableau_ventes.xlsx", format: XLSX, taille_octets: 142_000, message: "J’ai ajouté le filtre.", statut: "en_attente" }],
    });
    expect((await notifications(F)).at(-1)).toMatchObject({ titre: "Nouveau travail à corriger" });
    const autre = `${E}/${EXO}/v1-bis.xlsx`;
    await deposer(E, autre);
    await expect(rendre(E, EXO, autre)).rejects.toThrow("Votre travail attend déjà sa correction.");
  });

  it("un fichier absent, d'un autre compte, d'un format refusé ou trop lourd est refusé", async () => {
    await expect(rendre(E2, EXO, `${E2}/${EXO}/absent.xlsx`)).rejects.toThrow("Ce fichier n’a pas été reçu. Déposez-le à nouveau.");
    await expect(rendre(E2, EXO, `${E}/${EXO}/v1.xlsx`)).rejects.toThrow("Ce fichier n’a pas été reçu. Déposez-le à nouveau.");
    await deposer(E2, `${E2}/${EXO}/notes.txt`, "text/plain", 1000);
    await expect(rendre(E2, EXO, `${E2}/${EXO}/notes.txt`, "notes.txt")).rejects.toThrow("Ce format n’est pas accepté.");
    await deposer(E2, `${E2}/${EXO}/lourd.pdf`, "application/pdf", 25_000_000);
    await expect(rendre(E2, EXO, `${E2}/${EXO}/lourd.pdf`, "lourd.pdf")).rejects.toThrow("Le fichier dépasse 20 Mo.");
    expect(await exercice(E2, EXO)).toMatchObject({ statut: null, peut_deposer: true, versions: [] });
  });

  it("corriger : le formateur demande une correction (remarque exigée), l'étudiant redépose, l'équipe valide ; chacun est notifié", async () => {
    const [enAttente] = await aCorriger(F);
    expect(enAttente).toMatchObject({ etudiant: "Aïcha Kpadé", exercice: "Tableau des ventes", version: 1 });
    expect(await aCorriger(G)).toEqual([]);
    expect((await aCorriger(S)).map((c) => c.rendu_id)).toContain(enAttente.rendu_id);
    const detail = async (qui: string) => (await banc.en<{ d: Record<string, unknown> | null }>({ id: qui }, "select public.rendu_a_corriger($1) as d", [enAttente.rendu_id]))[0].d;
    expect(await detail(F)).toMatchObject({ etudiant: "Aïcha Kpadé", exercice: { titre: "Tableau des ventes" }, version: { version: 1, statut: "en_attente" } });
    expect(await detail(G)).toBeNull();
    expect(await detail(E)).toBeNull();

    await expect(corriger(F, enAttente.rendu_id, "a_corriger", "  ")).rejects.toThrow("Expliquez ce qu’il faut corriger.");
    await expect(corriger(G, enAttente.rendu_id, "valide", "")).rejects.toThrow(/pas l’une de vos formations/);
    await corriger(F, enAttente.rendu_id, "a_corriger", "Il manque le filtre par produit.");
    await expect(corriger(F, enAttente.rendu_id, "valide", "")).rejects.toThrow("Ce travail a déjà été corrigé.");
    expect((await notifications(E)).at(-1)).toMatchObject({ titre: "Une correction est demandée" });
    expect(await exercice(E, EXO)).toMatchObject({
      statut: "a_corriger",
      peut_deposer: true,
      versions: [{ version: 1, statut: "a_corriger", remarque: "Il manque le filtre par produit.", correcteur: "Mireille Adjovi" }],
    });

    const v2 = `${E}/${EXO}/v2.xlsx`;
    await deposer(E, v2);
    expect(await rendre(E, EXO, v2, "Tableau_ventes_v2.xlsx")).toMatchObject({ version: 2, statut: "en_attente" });
    const [suivant] = await aCorriger(S);
    await corriger(S, suivant.rendu_id, "valide", "Bravo !");
    expect((await notifications(E)).at(-1)).toMatchObject({ titre: "Exercice validé" });
    const fin = (await exercice(E, EXO))!;
    expect(fin).toMatchObject({ statut: "valide", peut_deposer: false });
    expect(fin.versions.map((v) => [v.version, v.statut])).toEqual([[2, "valide"], [1, "a_corriger"]]);
    const v3 = `${E}/${EXO}/v3.xlsx`;
    await deposer(E, v3);
    await expect(rendre(E, EXO, v3)).rejects.toThrow("Cet exercice est déjà validé.");
  });

  it("le fichier se lit par son auteur et les correcteurs, ni par un autre étudiant ni par un autre formateur ; attaché, il ne s'efface pas", async () => {
    const chemin = `${E}/${EXO}/v1.xlsx`;
    expect([await lit(E, chemin), await lit(F, chemin), await lit(S, chemin), await lit(G, chemin), await lit(E2, chemin)]).toEqual([1, 1, 1, 0, 0]);
    const rendu = (await un<{ id: string }>("select id from public.rendus_exercices where fichier = $1", [chemin])).id;
    const fichier = async (qui: string) => (await banc.en<{ f: { chemin: string; nom: string } | null }>({ id: qui }, "select public.fichier_rendu($1) as f", [rendu]))[0].f;
    const attendu = { chemin, nom: "Tableau_ventes.xlsx" };
    expect([await fichier(E), await fichier(F), await fichier(E2), await fichier(G)]).toEqual([attendu, attendu, null, null]);
    expect(await banc.en({ id: E }, "delete from storage.objects where bucket_id = 'rendus' and name = $1 returning name", [chemin])).toEqual([]);
    expect(await banc.en({ id: E }, "delete from storage.objects where bucket_id = 'rendus' and name = $1 returning name", [`${E}/${EXO}/v3.xlsx`])).toHaveLength(1);
    await expect(deposer(E, `${E2}/${EXO}/intrus.xlsx`)).rejects.toThrow(/row-level security/);
  });

  it("un exercice simple se termine d'un clic, sans dépôt ; un exercice avec rendu demande un dépôt", async () => {
    expect(await banc.en({ id: E }, "select public.terminer_exercice($1)", [SIMPLE])).toHaveLength(1);
    await banc.en({ id: E }, "select public.terminer_exercice($1)", [SIMPLE]);
    expect(await exercice(E, SIMPLE)).toMatchObject({ genre: "simple", statut: "valide", versions: [{ version: 1, statut: "valide" }] });
    const chemin = `${E}/${SIMPLE}/x.pdf`;
    await deposer(E, chemin, "application/pdf", 1000);
    await expect(rendre(E, SIMPLE, chemin, "x.pdf")).rejects.toThrow("Cet exercice se termine sans dépôt.");
    await expect(banc.en({ id: E2 }, "select public.terminer_exercice($1)", [EXO])).rejects.toThrow("Cet exercice demande un dépôt.");
  });

  it("sans accès (brouillon, visiteur) : rien ; une leçon n'est pas un exercice ; les tables restent fermées", async () => {
    expect(await exercice(E, BROUILLON)).toBeNull();
    const chemin = `${E}/${BROUILLON}/a.pdf`;
    await deposer(E, chemin, "application/pdf", 1000);
    await expect(rendre(E, BROUILLON, chemin, "a.pdf")).rejects.toThrow("Cet exercice ne vous est pas ouvert.");
    expect(await exercice(E, LECON)).toBeNull();
    await expect(banc.en("anon", "select public.exercice_etudiant($1)", [EXO])).rejects.toThrow(/permission denied/);
    await expect(banc.en({ id: E }, "select * from public.rendus_exercices")).rejects.toThrow(/permission denied|row-level security/);
  });

  it("les listes de l'étudiant : ses exercices (dernier statut, remarque) et les statuts d'une formation", async () => {
    const liste = (await banc.en<{ l: { lecon_id: string; titre: string; formation: string; statut: string; remarque: string; correcteur: string }[] }>({ id: E }, "select public.mes_exercices() as l"))[0].l;
    expect(liste.map((x) => [x.titre, x.statut]).sort()).toEqual([["Nettoyer une enquête", "valide"], ["Tableau des ventes", "valide"]]);
    expect(liste.find((x) => x.lecon_id === EXO)).toMatchObject({ formation: "Excel", remarque: "Bravo !" });
    const statuts = (await banc.en<{ s: Record<string, string> }>({ id: E }, "select public.mes_statuts_exercices($1) as s", [FORMATION]))[0].s;
    expect(statuts).toEqual({ [EXO]: "valide", [SIMPLE]: "valide" });
    expect((await banc.en<{ l: unknown[] }>({ id: E2 }, "select public.mes_exercices() as l"))[0].l).toEqual([]);
  });
});
