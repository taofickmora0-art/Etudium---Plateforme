import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0015 : suivi des étudiants par le formateur et tableau de bord (spec 2026-10-14-etudiants-tableau-de-bord-
// formateur). Définitions (§2) : étudiant = a ouvert une leçon ; ni le formateur lui-même ni l'équipe ; à risque après
// 10 jours sans activité ; terminée quand toutes les leçons le sont.
const MIGRATION = "supabase/migrations/0015_suivi_etudiants.sql";
const REFUS = /row-level security|permission denied/;
const SANS_FICHE = /pas encore relié à une fiche formateur/;

let banc: Banc;
const F = randomUUID(); // formateur, fiche FA (formations X et Y)
const G = randomUUID(); // formateur, fiche FB (formation Z)
const H = randomUUID(); // formateur sans fiche
const E1 = randomUUID(); // « Fifamè Adjovi » : a terminé X
const E2 = randomUUID(); // « Rodrigue Houngbo » : X ouvert il y a 12 jours
const E3 = randomUUID(); // suit Z seulement
const A = randomUUID(); // admin, ouvre X
const S = randomUUID(); // super admin
let FA: string;
let X: string;
let Y: string;
let leconsX: string[];
let leconsY: string[];

type Ligne = { etudiant_id: string; prenom: string; nom: string; formation_id: string; formation_titre: string; terminees: number; total: number; derniere_activite: string; etat: string };
type Page = { total: number; lignes: Ligne[] };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
async function formation(titre: string, fiche: string, nbLecons: number): Promise<[string, string[]]> {
  const f = await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, statut) values ($1, $2, $3, 'publiee') returning id", [titre, randomUUID(), fiche]);
  const m = await un<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 1', 1) returning id", [f.id]);
  const lecons: string[] = [];
  for (let i = 1; i <= nbLecons; i++) lecons.push((await un<{ id: string }>("insert into public.lecons (module_id, titre, ordre) values ($1, $2, $3) returning id", [m.id, `Leçon ${i}`, i])).id);
  return [f.id, lecons];
}
const progression = (compte: string, lecon: string, il_y_a: string, terminee = false, passages = "{}") =>
  banc.db.query(
    `insert into public.progression_lecons (profil_id, lecon_id, vue_le, ouverte_le, terminee_le, passages)
     values ($1, $2, now() - $3::interval, now() - $3::interval, case when $4 then now() - $3::interval end, $5::int4multirange)
     on conflict (profil_id, lecon_id) do update set vue_le = excluded.vue_le, terminee_le = excluded.terminee_le, passages = excluded.passages`,
    [compte, lecon, il_y_a, terminee, passages],
  );
const liste = async (qui: string, recherche = "", formationId: string | null = null, etat = "tous", page = 1) =>
  (await banc.en<{ r: Page }>({ id: qui }, "select public.etudiants_formateur($1, $2, $3, $4) as r", [recherche, formationId, etat, page]))[0].r;
const paires = (p: Page) => p.lignes.map((l) => `${l.etudiant_id === E1 ? "E1" : l.etudiant_id === E2 ? "E2" : l.etudiant_id}/${l.formation_id === X ? "X" : l.formation_id === Y ? "Y" : "?"}`);

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
    MIGRATION,
  ]);
  for (const [id, roles] of [[F, []], [G, []], [H, ["formateur"]], [E1, []], [E2, []], [E3, []], [A, ["admin"]], [S, ["super_admin"]]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Fifamè', nom = 'Adjovi' where id = $1", [E1]);
  await banc.db.query("update public.profils set prenom = 'Rodrigue', nom = 'Houngbo' where id = $1", [E2]);
  await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [F]);
  await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [G]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const FB = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [G])).id;
  [X, leconsX] = await formation("Maîtriser Microsoft Excel", FA, 4);
  [Y, leconsY] = await formation("Word", FA, 2);
  const [, leconsZ] = await formation("Zotero", FB, 1);
  for (const [i, l] of leconsX.entries()) await progression(E1, l, "1 day", true, i === 0 ? "{[0,90)}" : "{}");
  await progression(E2, leconsX[0], "12 days");
  await progression(F, leconsX[0], "1 hour");
  await progression(A, leconsX[1], "1 hour");
  await progression(E3, leconsZ[0], "2 days");
});

describe("Migration 0015 : suivi des étudiants", () => {
  it("une ligne par étudiant et par formation ; ni le formateur lui-même ni l'équipe ; pas les étudiants d'un autre", async () => {
    const p = await liste(F);
    expect(paires(p)).toEqual(["E1/X", "E2/X"]);
    expect(p.total).toBe(2);
    expect(p.lignes[0]).toMatchObject({ prenom: "Fifamè", nom: "Adjovi", formation_titre: "Maîtriser Microsoft Excel", terminees: 4, total: 4 });
  });

  it("états : terminée, à risque après 10 jours, en cours", async () => {
    await progression(E2, leconsY[0], "1 minute");
    const etats = Object.fromEntries((await liste(F)).lignes.map((l) => [`${l.etudiant_id === E1 ? "E1" : "E2"}/${l.formation_id === X ? "X" : "Y"}`, l.etat]));
    expect(etats).toEqual({ "E1/X": "terminee", "E2/X": "a_risque", "E2/Y": "en_cours" });
  });

  it("filtres : formation, état, recherche sans accents ; % _ ' ne sont pas des jokers", async () => {
    expect(paires(await liste(F, "", Y))).toEqual(["E2/Y"]);
    expect(paires(await liste(F, "", null, "a_risque"))).toEqual(["E2/X"]);
    expect(paires(await liste(F, "", null, "terminees"))).toEqual(["E1/X"]);
    expect(paires(await liste(F, "fifame"))).toEqual(["E1/X"]);
    expect(paires(await liste(F, "  HOUNG "))).toEqual(["E2/Y", "E2/X"]);
    for (const q of ["%", "_", "l'a"]) expect((await liste(F, q)).total).toBe(0);
    expect((await liste(F, "", null, "nimporte")).total).toBe(3);
  });

  it("aucune adresse e-mail dans ce qui est livré au formateur", async () => {
    expect(JSON.stringify(await liste(F))).not.toContain("@");
    expect(JSON.stringify((await banc.en({ id: F }, "select public.etudiant_formateur($1) as r", [E1]))[0])).not.toContain("@");
  });

  it("la fiche d'un étudiant : ses formations chez ce formateur, leçons dans l'ordre, temps de vidéo", async () => {
    const [{ r }] = await banc.en<{ r: { prenom: string; formations: { titre: string; terminees: number; total: number; secondes: number; etat: string; modules: { titre: string; lecons: { titre: string; etat: string; secondes: number }[] }[] }[]; remarque: unknown } }>(
      { id: F },
      "select public.etudiant_formateur($1) as r",
      [E2],
    );
    expect(r.prenom).toBe("Rodrigue");
    expect(r.formations.map((f) => f.titre).sort()).toEqual(["Maîtriser Microsoft Excel", "Word"]);
    const x = r.formations.find((f) => f.titre === "Maîtriser Microsoft Excel")!;
    expect(x).toMatchObject({ terminees: 0, total: 4, etat: "a_risque" });
    expect(x.modules[0].lecons.map((l) => [l.titre, l.etat])).toEqual([
      ["Leçon 1", "ouverte"],
      ["Leçon 2", "non_ouverte"],
      ["Leçon 3", "non_ouverte"],
      ["Leçon 4", "non_ouverte"],
    ]);
    const [{ r: e1 }] = await banc.en<{ r: { formations: { secondes: number; modules: { lecons: { etat: string; secondes: number }[] }[] }[] } }>(
      { id: F },
      "select public.etudiant_formateur($1) as r",
      [E1],
    );
    expect(e1.formations[0].secondes).toBe(90);
    expect(e1.formations[0].modules[0].lecons.map((l) => [l.etat, l.secondes])).toEqual([
      ["terminee", 90],
      ["terminee", 0],
      ["terminee", 0],
      ["terminee", 0],
    ]);
    expect(r.remarque).toBeNull();
  });

  it("la fiche d'un étudiant d'un autre formateur, du formateur lui-même, ou inconnu : null", async () => {
    for (const qui of [E3, F, A, randomUUID()]) expect(await banc.en({ id: F }, "select public.etudiant_formateur($1) as r", [qui])).toEqual([{ r: null }]);
  });

  it("refus : étudiant, visiteur, formateur sans fiche ou suspendu ; suivi_formateur n'est pas appelable", async () => {
    await expect(banc.en({ id: E1 }, "select public.etudiants_formateur()")).rejects.toThrow(SANS_FICHE);
    await expect(banc.en({ id: H }, "select public.etudiants_formateur()")).rejects.toThrow(SANS_FICHE);
    await expect(banc.en({ id: H }, "select public.etudiant_formateur($1)", [E1])).rejects.toThrow(SANS_FICHE);
    await expect(banc.en("anon", "select public.etudiants_formateur()")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: F }, "select * from public.suivi_formateur($1)", [FA])).rejects.toThrow(REFUS);
    await banc.en({ id: S }, "select public.suspendre_compte($1)", [F]);
    await expect(banc.en({ id: F }, "select public.etudiants_formateur()")).rejects.toThrow(SANS_FICHE);
    await banc.en({ id: S }, "select public.reactiver_compte($1)", [F]);
  });

  it("pages de 25, les plus récemment actifs d'abord", async () => {
    for (let i = 0; i < 30; i++) {
      const id = randomUUID();
      await banc.creerCompte(id);
      await progression(id, leconsY[1], `${i + 2} hours`);
    }
    const p1 = await liste(F);
    const p2 = await liste(F, "", null, "tous", 2);
    expect(p1.total).toBe(33);
    expect(p1.lignes).toHaveLength(25);
    expect(p2.lignes).toHaveLength(8);
    expect(paires(p1).slice(0, 1)).toEqual(["E2/Y"]);
    const dates = [...p1.lignes, ...p2.lignes].map((l) => l.derniere_activite);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("une leçon ajoutée après coup : la formation n'est plus terminée", async () => {
    const mod = (await un<{ module_id: string }>("select module_id from public.lecons where id = $1", [leconsX[0]])).module_id;
    await banc.db.query("insert into public.lecons (module_id, titre, ordre) values ($1, 'Leçon 5', 5)", [mod]);
    const e1 = (await liste(F, "fifame")).lignes[0];
    expect(e1).toMatchObject({ terminees: 4, total: 5, etat: "en_cours" });
  });

  it("la migration est rejouable", async () => {
    await banc.appliquer(MIGRATION);
    expect((await liste(F, "fifame")).total).toBe(1);
  });
});

describe("Migration 0015 : remarques privées", () => {
  const remarque = async (qui: string, etudiant: string, texte: string) => banc.en({ id: qui }, "select public.enregistrer_remarque($1, $2)", [etudiant, texte]);
  const remarqueDeF = async (etudiant: string) =>
    (await banc.en<{ r: { remarque: { texte: string; modifiee_le: string } | null } }>({ id: F }, "select public.etudiant_formateur($1) as r", [etudiant]))[0].r.remarque;

  it("une remarque : écrite par le formateur pour son étudiant, relue sur la fiche", async () => {
    await remarque(F, E1, "  A du mal avec les formules.  ");
    expect(await remarqueDeF(E1)).toMatchObject({ texte: "A du mal avec les formules.", modifiee_le: expect.any(String) });
    await remarque(F, E1, "Progresse bien.");
    expect((await remarqueDeF(E1))!.texte).toBe("Progresse bien.");
  });

  it("un texte vide supprime la remarque ; plus de 2 000 caractères refusé", async () => {
    await remarque(F, E2, "Relancer.");
    await remarque(F, E2, "   ");
    expect(await remarqueDeF(E2)).toBeNull();
    await expect(remarque(F, E2, "x".repeat(2001))).rejects.toThrow(/2 000 caractères/);
  });

  it("ni l'étudiant ni un autre formateur ne la lisent ; l'équipe oui, avec le nom de la fiche", async () => {
    await remarque(G, E3, "Remarque de G.");
    expect(await banc.en({ id: E1 }, "select texte from public.remarques_formateur")).toEqual([]);
    expect(await banc.en<{ texte: string }>({ id: F }, "select texte from public.remarques_formateur")).toEqual([{ texte: "Progresse bien." }]);
    expect(await banc.en<{ texte: string }>({ id: G }, "select texte from public.remarques_formateur")).toEqual([{ texte: "Remarque de G." }]);
    expect((await banc.en({ id: A }, "select texte from public.remarques_formateur")).length).toBe(2);
    const [{ r }] = await banc.en<{ r: { formateur_nom: string; texte: string }[] }>({ id: A }, "select public.remarques_compte($1) as r", [E1]);
    expect(r).toEqual([expect.objectContaining({ formateur_nom: expect.stringMatching(/^Test /), texte: "Progresse bien." })]);
    await expect(banc.en({ id: F }, "select public.remarques_compte($1)", [E1])).rejects.toThrow(/équipe/);
  });

  it("pas de remarque sur un étudiant d'un autre formateur ; pas d'écriture directe", async () => {
    await expect(remarque(F, E3, "Intrus.")).rejects.toThrow(/ne suit aucune de vos formations/);
    await expect(remarque(H, E1, "Sans fiche.")).rejects.toThrow(SANS_FICHE);
    await expect(banc.en({ id: F }, "insert into public.remarques_formateur (formateur, etudiant, texte) values ($1, $2, 'Directe')", [F, E1])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: F }, "update public.remarques_formateur set texte = 'Directe'")).rejects.toThrow(REFUS);
  });
});

describe("Migration 0015 : tableau de bord du formateur", () => {
  const MAINTENANT = "2026-10-14T12:00:00Z";
  const E4 = randomUUID();
  const E5 = randomUUID();
  let W: string;
  const fixe = (compte: string, lecon: string, ouverte: string, vue: string, terminee: string | null = null) =>
    banc.db.query(
      "insert into public.progression_lecons (profil_id, lecon_id, ouverte_le, vue_le, terminee_le) values ($1, $2, $3, $4, $5)",
      [compte, lecon, ouverte, vue, terminee],
    );
  type Tableau = {
    prenom: string;
    formations: { total: number; brouillons: number };
    etudiants: { total: number; ce_mois: number };
    progression_moyenne: number | null;
    a_risque: { etudiant_id: string; formation_titre: string; jours: number; pourcentage: number }[];
    formations_detail: { id: string; titre: string; statut: string; inscrits: number; progression_moyenne: number | null; completion: number | null; note_moyenne: number | null }[];
  };
  const tableau = async (qui = F) => (await banc.en<{ r: Tableau }>({ id: qui }, "select public.tableau_de_bord_formateur($1) as r", [MAINTENANT]))[0].r;

  beforeAll(async () => {
    // Des données datées autour de MAINTENANT, à la place de celles des tests précédents.
    await banc.db.query(
      "delete from public.progression_lecons where lecon_id in (select l.id from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = any($1))",
      [[X, Y]],
    );
    await banc.creerCompte(E4);
    await banc.creerCompte(E5);
    const leconsX5 = (await banc.db.query<{ id: string }>("select l.id from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $1 order by l.ordre", [X])).rows.map((l) => l.id);
    for (const l of leconsX5) await fixe(E1, l, "2026-10-01T10:00:00Z", "2026-10-13T10:00:00Z", "2026-10-13T10:00:00Z"); // X terminée
    await fixe(E2, leconsX5[0], "2026-09-20T12:00:00Z", "2026-09-20T12:00:00Z"); // X, 24 jours sans activité, arrivé en septembre
    await fixe(E4, leconsY[0], "2026-10-02T12:00:00Z", "2026-10-02T12:00:00Z"); // Y, 12 jours sans activité
    await fixe(E5, leconsY[0], "2026-10-14T09:00:00Z", "2026-10-14T09:00:00Z", "2026-10-14T09:00:00Z"); // Y, 1 / 2 aujourd'hui
    await fixe(F, leconsX5[1], "2026-10-14T09:00:00Z", "2026-10-14T09:00:00Z"); // le formateur lui-même
    await fixe(A, leconsX5[2], "2026-10-14T09:00:00Z", "2026-10-14T09:00:00Z"); // l'équipe
    W = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id) values ('Brouillon', $1, $2) returning id", [randomUUID(), FA])).id;
  });

  it("chiffres : formations, étudiants (+ce mois), progression moyenne ; ni le formateur ni l'équipe", async () => {
    const t = await tableau();
    expect(t.prenom).toBe("Test");
    expect(t.formations).toEqual({ total: 3, brouillons: 1 });
    // E1, E2, E4, E5 ; ce mois (depuis le 1er octobre, heure du Bénin) : E1, E4, E5.
    expect(t.etudiants).toEqual({ total: 4, ce_mois: 3 });
    // Moyenne de 100 (E1 X), 0 (E2 X), 0 (E4 Y), 50 (E5 Y) = 37,5 → 38.
    expect(t.progression_moyenne).toBe(38);
  });

  it("à risque : les plus inactifs d'abord, avec leurs jours et leur progression", async () => {
    const t = await tableau();
    expect(t.a_risque.map((r) => [r.etudiant_id, r.jours, r.pourcentage])).toEqual([
      [E2, 24, 0],
      [E4, 12, 0],
    ]);
    expect(t.a_risque[0].formation_titre).toBe("Maîtriser Microsoft Excel");
  });

  it("détail par formation : inscrits, progression moyenne, complétion ; une formation sans étudiant n'a pas de chiffres", async () => {
    const detail = Object.fromEntries((await tableau()).formations_detail.map((f) => [f.id, f]));
    expect(detail[X]).toMatchObject({ inscrits: 2, progression_moyenne: 50, completion: 50, statut: "publiee" });
    expect(detail[Y]).toMatchObject({ inscrits: 2, progression_moyenne: 25, completion: 0 });
    expect(detail[W]).toMatchObject({ inscrits: 0, progression_moyenne: null, completion: null, statut: "brouillon" });
  });

  it("au plus 5 étudiants à risque", async () => {
    for (let i = 0; i < 6; i++) {
      const id = randomUUID();
      await banc.creerCompte(id);
      await fixe(id, leconsY[1], "2026-09-01T12:00:00Z", `2026-09-0${i + 2}T12:00:00Z`);
    }
    expect((await tableau()).a_risque).toHaveLength(5);
  });

  it("refus : sans fiche ; un autre formateur ne voit que ses formations", async () => {
    await expect(banc.en({ id: E1 }, "select public.tableau_de_bord_formateur()")).rejects.toThrow(SANS_FICHE);
    await expect(banc.en("anon", "select public.tableau_de_bord_formateur()")).rejects.toThrow(REFUS);
    expect((await tableau(G)).formations.total).toBe(1);
  });

  it("la migration reste rejouable", async () => {
    await banc.appliquer(MIGRATION);
    expect((await tableau()).etudiants.total).toBeGreaterThan(0);
  });
});

describe("Migration 0015 : un étudiant de deux formateurs", () => {
  const E6 = randomUUID();
  beforeAll(async () => {
    await banc.creerCompte(E6);
    // Par identifiant : les exemples du lot 1 ont aussi une formation « Maîtriser Microsoft Excel ».
    const premiere = async (formationId: string) =>
      (await un<{ id: string }>("select l.id from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $1 order by l.ordre limit 1", [formationId])).id;
    const zotero = (await un<{ id: string }>("select f.id from public.formations f join public.formateurs fo on fo.id = f.formateur_id where fo.compte_id = $1", [G])).id;
    await progression(E6, await premiere(X), "1 hour");
    await progression(E6, await premiere(zotero), "1 hour");
    await banc.en({ id: G }, "select public.enregistrer_remarque($1, 'Remarque de G sur E6.')", [E6]);
  });

  it("chaque formateur ne voit que ses formations et sa propre remarque", async () => {
    const fiche = async (qui: string) =>
      (await banc.en<{ r: { formations: { titre: string }[]; remarque: { texte: string } | null } }>({ id: qui }, "select public.etudiant_formateur($1) as r", [E6]))[0].r;
    const vueDeF = await fiche(F);
    expect(vueDeF.formations.map((f) => f.titre)).toEqual(["Maîtriser Microsoft Excel"]);
    expect(vueDeF.remarque).toBeNull();
    const vueDeG = await fiche(G);
    expect(vueDeG.formations.map((f) => f.titre)).toEqual(["Zotero"]);
    expect(vueDeG.remarque).toMatchObject({ texte: "Remarque de G sur E6." });
    await banc.en({ id: F }, "select public.enregistrer_remarque($1, 'Remarque de F sur E6.')", [E6]);
    expect((await fiche(F)).remarque).toMatchObject({ texte: "Remarque de F sur E6." });
    expect((await fiche(G)).remarque).toMatchObject({ texte: "Remarque de G sur E6." });
    const lignesDeF = (await liste(F, "", null, "tous", 1)).lignes.filter((l) => l.etudiant_id === E6);
    expect(lignesDeF.map((l) => l.formation_titre)).toEqual(["Maîtriser Microsoft Excel"]);
  });
});
