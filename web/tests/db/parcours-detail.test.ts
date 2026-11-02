import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, creerParcours, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0066 : la fiche d'un parcours au back-office (demande du 2 novembre 2026) : ses chiffres, ses formations
// dans l'ordre (à ranger, à changer de parcours, à ajouter), ses apprenants. L'équipe des contenus seulement.

let banc: Banc;
const [A, MOD, E1, E2] = Array.from({ length: 4 }, () => randomUUID());
let P1: string;
let P2: string;
let P3: string;
const f: Record<string, FormationTest> = {};

type Detail = {
  chiffres: { formations_publiees: number; formations_brouillons: number; apprenants: number; certificats: number; sessions_a_venir: number; publications_30j: number };
  formations: { id: string; titre: string; statut: string; apprenants: number; certificats: number; autres_parcours: string[] }[];
  apprenants: { total: number; liste: { id: string; nom: string; formations: number; certificats: number; derniere_activite: string }[] };
  sessions: { id: string; titre: string; debut: string }[];
  a_ajouter: { id: string; titre: string; statut: string }[];
};
const detail = async (p: string, qui = A) => (await banc.en<{ d: Detail }>({ id: qui }, "select public.parcours_detail_back_office($1) as d", [p]))[0].d;
const ordre = async (p: string) =>
  (await banc.db.query<{ titre: string }>("select f.titre from public.formations_parcours fp join public.formations f on f.id = fp.formation_id where fp.parcours_id = $1 order by fp.ordre, f.titre", [p])).rows.map((r) => r.titre);
const ouvrir = (qui: string, formation: FormationTest, quand = "now()") =>
  banc.db.query(`insert into public.progression_lecons (profil_id, lecon_id, vue_le) values ($1, $2, ${quand}) on conflict do nothing`, [qui, formation.lecons[0]]);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0066"));
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(MOD, ["moderateur"]);
  for (const id of [E1, E2]) await banc.creerCompte(id);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [E1]);
  await banc.db.query("update public.profils set prenom = 'Jules', nom = 'Koffi' where id = $1", [E2]);
  P1 = await creerParcours(banc, "Réussite académique");
  P2 = await creerParcours(banc, "Compétences digitales", "digital");
  P3 = await creerParcours(banc, "Business", "business");
  const sans = { quiz: false, exercice: null } as const;
  f.word = await creerFormation(banc, "Word", { ...sans, parcours: [P1], ordre: 1 });
  f.zotero = await creerFormation(banc, "Zotero", { ...sans, parcours: [P1, P2], ordre: 2 });
  f.memoire = await creerFormation(banc, "Mémoire", { ...sans, parcours: [P1], ordre: 3, statut: "brouillon" });
  f.canva = await creerFormation(banc, "Canva", { ...sans, parcours: [P2] });
  f.vendre = await creerFormation(banc, "Vendre ses visuels", { ...sans, parcours: [P3] });
  await banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [f.vendre.id, f.canva.id]);
  await ouvrir(E1, f.word, "now() - interval '2 days'");
  await ouvrir(E1, f.zotero, "now() - interval '1 day'");
  await ouvrir(E2, f.word, "now() - interval '5 days'");
  await poserCertificat(banc, E1, f.word);
  await banc.db.query(
    "insert into public.sessions_live (titre, debut, duree_minutes, lien, parcours_id, statut, cree_par) values ('Atelier Word', now() + interval '2 days', 60, 'https://meet.google.com/abc-defg-hij', $1, 'programmee', $2)",
    [P1, A],
  );
  await banc.db.query("insert into public.publications (auteur, parcours_id, texte) values ($1, $2, 'Bonjour')", [E1, P1]);
}, 60_000);

describe("Migration 0066 : la fiche d'un parcours", () => {
  it("les chiffres, les formations dans l'ordre (avec leurs autres parcours), les prochaines sessions", async () => {
    const d = await detail(P1);
    expect(d.chiffres).toEqual({ formations_publiees: 2, formations_brouillons: 1, apprenants: 2, certificats: 1, sessions_a_venir: 1, publications_30j: 1 });
    expect(d.formations.map((x) => [x.titre, x.statut, x.apprenants, x.certificats, x.autres_parcours])).toEqual([
      ["Word", "publiee", 2, 1, []],
      ["Zotero", "publiee", 1, 0, ["Compétences digitales"]],
      ["Mémoire", "brouillon", 0, 0, []],
    ]);
    expect(d.sessions.map((s) => s.titre)).toEqual(["Atelier Word"]);
    expect(d.a_ajouter.map((x) => x.titre)).toEqual(["Canva", "Vendre ses visuels"]);
  });

  it("les apprenants : le plus récemment actif d'abord, avec ses formations commencées et ses certificats", async () => {
    const d = await detail(P1);
    expect(d.apprenants.total).toBe(2);
    expect(d.apprenants.liste.map((a) => [a.nom, a.formations, a.certificats])).toEqual([
      ["Aïcha Kpadé", 2, 1],
      ["Jules Koffi", 1, 0],
    ]);
  });

  it("ranger une formation à un rang du parcours", async () => {
    await banc.en({ id: A }, "select public.ranger_formation_parcours($1, $2, 1)", [P1, f.memoire.id]);
    expect(await ordre(P1)).toEqual(["Mémoire", "Word", "Zotero"]);
    await banc.en({ id: A }, "select public.ranger_formation_parcours($1, $2, 9)", [P1, f.memoire.id]);
    expect(await ordre(P1)).toEqual(["Word", "Zotero", "Mémoire"]);
  });

  it("changer une formation de parcours : retirée de l'un, ajoutée en fin de l'autre", async () => {
    await banc.en({ id: A }, "select public.changer_parcours_formation($1, $2, $3)", [f.word.id, P1, P2]);
    expect(await ordre(P1)).toEqual(["Zotero", "Mémoire"]);
    expect((await ordre(P2)).at(-1)).toBe("Word");
    // Déjà dans le parcours d'arrivée : elle quitte seulement celui de départ.
    await banc.en({ id: A }, "select public.changer_parcours_formation($1, $2, $3)", [f.zotero.id, P1, P2]);
    expect(await ordre(P1)).toEqual(["Mémoire"]);
    expect((await ordre(P2)).filter((t) => t === "Zotero")).toHaveLength(1);
  });

  it("une formation liée à la monétisation ne quitte pas le parcours qui rend ce lien valable", async () => {
    await expect(banc.en({ id: A }, "select public.changer_parcours_formation($1, $2, $3)", [f.canva.id, P2, P1])).rejects.toThrow(/monétisation/);
    await expect(banc.en({ id: A }, "select public.changer_parcours_formation($1, $2, $3)", [f.vendre.id, P3, P1])).rejects.toThrow(/monétisation/);
  });

  it("ajouter une formation existante au parcours, en fin ; déjà dedans, rien ne change", async () => {
    await banc.en({ id: A }, "select public.ajouter_formation_parcours($1, $2)", [P3, f.memoire.id]);
    expect(await ordre(P3)).toEqual(["Vendre ses visuels", "Mémoire"]);
    await banc.en({ id: A }, "select public.ajouter_formation_parcours($1, $2)", [P3, f.memoire.id]);
    expect(await ordre(P3)).toEqual(["Vendre ses visuels", "Mémoire"]);
  });

  it("réservé à l'équipe des contenus", async () => {
    for (const qui of [MOD, E1]) {
      await expect(detail(P1, qui)).rejects.toThrow();
      await expect(banc.en({ id: qui }, "select public.ranger_formation_parcours($1, $2, 1)", [P1, f.zotero.id])).rejects.toThrow();
      await expect(banc.en({ id: qui }, "select public.changer_parcours_formation($1, $2, $3)", [f.zotero.id, P2, P1])).rejects.toThrow();
      await expect(banc.en({ id: qui }, "select public.ajouter_formation_parcours($1, $2)", [P1, f.canva.id])).rejects.toThrow();
    }
  });
});
