import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0014 : espace formateur, « Mes formations » (spec 2026-10-13-espace-formateur-formations) : le formateur
// écrit dans ses formations, jamais dans les réglages de l'équipe ; relecture par un admin.
const MIGRATION = "supabase/migrations/0014_espace_formateur.sql";
const REFUS = /row-level security|permission denied/;
const REGLAGE = /revient à l’équipe Étudium/;

let banc: Banc;
const F = randomUUID(); // formateur, fiche FA
const G = randomUUID(); // formateur, fiche FB
const H = randomUUID(); // formateur sans fiche
const E = randomUUID(); // étudiant
const A = randomUUID(); // admin
const S = randomUUID(); // super admin
let FA: string;
let FB: string;
let MA: string; // brouillon de FA, une leçon
let PUB: string; // publiée de FA, réglée par l'équipe
let AUTRE: string; // brouillon de FB
let leconMA: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const formation = async (slug: string, formateur: string, statut = "brouillon") =>
  (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, statut) values ($1, $1, $2, $3::public.statut_formation) returning id", [slug, formateur, statut])).id;
const lecon = async (formationId: string) => {
  const m = await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module') returning id", [formationId]);
  const l = await un<{ id: string }>("insert into public.lecons (module_id, titre) values ($1, 'Leçon') returning id", [m.id]);
  await banc.db.query("insert into public.lecons_contenus (lecon_id) values ($1)", [l.id]);
  return l.id;
};

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
    MIGRATION,
  ]);
  for (const [id, roles] of [[F, []], [G, []], [H, ["formateur"]], [E, []], [A, ["admin"]], [S, ["super_admin"]]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [F]);
  await banc.en({ id: S }, "select public.changer_roles($1, '{formateur}', null, true)", [G]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  FB = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [G])).id;
  MA = await formation("ma-formation", FA);
  leconMA = await lecon(MA);
  PUB = await formation("ma-publiee", FA);
  await lecon(PUB);
  await banc.db.query("update public.formations set statut = 'publiee', gratuite = true, prix_fcfa = 5000, badge = 'populaire' where id = $1", [PUB]);
  AUTRE = await formation("autre-formation", FB);
  await lecon(AUTRE);
});

describe("Migration 0014 : droits du formateur", () => {
  it("le formateur voit ses formations, pas le brouillon d'un autre", async () => {
    const vues = async (qui: string) =>
      (await banc.en<{ id: string }>({ id: qui }, "select id from public.formations where id = any($1)", [[MA, PUB, AUTRE]])).map((f) => f.id).sort();
    expect(await vues(F)).toEqual([MA, PUB].sort());
    expect(await vues(G)).toEqual([PUB, AUTRE].sort());
    expect(await vues(E)).toEqual([PUB]);
  });

  it("il crée une formation : brouillon, à sa fiche, réglages par défaut (rien de ce qu'il envoie d'autre)", async () => {
    const [cree] = await banc.en<Record<string, unknown>>(
      { id: F },
      `insert into public.formations (titre, slug, formateur_id, statut, gratuite, achat_separe, prix_fcfa, badge, seuil_video, note_moyenne, nb_avis, envoyee_le)
       values ('Ma nouvelle', 'ma-nouvelle', $1, 'publiee', true, true, 1000, 'populaire', 60, 5, 99, now())
       returning statut, formateur_id, gratuite, achat_separe, prix_fcfa, badge, seuil_video, note_moyenne, nb_avis, envoyee_le, publiee_le`,
      [FB],
    );
    expect(cree).toEqual({
      statut: "brouillon",
      formateur_id: FA,
      gratuite: false,
      achat_separe: false,
      prix_fcfa: null,
      badge: null,
      seuil_video: 90,
      note_moyenne: null,
      nb_avis: 0,
      envoyee_le: null,
      publiee_le: null,
    });
  });

  it("sans fiche, suspendu, ou étudiant : il ne crée rien", async () => {
    await expect(banc.en({ id: H }, "insert into public.formations (titre, slug) values ('X', 'x-sans-fiche')")).rejects.toThrow(/pas encore relié à une fiche formateur/);
    await expect(banc.en({ id: E }, "insert into public.formations (titre, slug) values ('X', 'x-etudiant')")).rejects.toThrow();
    await banc.en({ id: A }, "select public.suspendre_compte($1)", [G]);
    await expect(banc.en({ id: G }, "insert into public.formations (titre, slug) values ('X', 'x-suspendu')")).rejects.toThrow();
    expect(await banc.en({ id: G }, "update public.formations set titre = 'Piraté' where id = $1 returning id", [AUTRE])).toEqual([]);
    await banc.en({ id: A }, "select public.reactiver_compte($1)", [G]);
  });

  it("il modifie le contenu de ses formations, programme compris", async () => {
    expect(await banc.en({ id: F }, "update public.formations set titre = 'Nouveau titre', resume = 'Résumé' where id = $1 returning titre", [MA])).toEqual([{ titre: "Nouveau titre" }]);
    const [m] = await banc.en<{ id: string }>({ id: F }, "insert into public.modules (formation_id, titre) values ($1, 'Module 2') returning id", [MA]);
    const [l] = await banc.en<{ id: string }>({ id: F }, "insert into public.lecons (module_id, titre) values ($1, 'Leçon 2') returning id", [m.id]);
    await banc.en({ id: F }, "insert into public.lecons_contenus (lecon_id, texte) values ($1, 'Texte')", [l.id]);
    await banc.en({ id: F }, "insert into public.ressources (lecon_id, titre, fichier, format) values ($1, 'Fiche', $2, 'pdf')", [l.id, `${MA}/${randomUUID()}.pdf`]);
    await banc.en({ id: F }, "update public.lecons_contenus set texte = 'Autre texte' where lecon_id = $1", [l.id]);
    expect(await banc.en({ id: F }, "delete from public.lecons where id = $1 returning id", [l.id])).toEqual([{ id: l.id }]);
    const parcours = (await un<{ id: string }>("select id from public.parcours limit 1")).id;
    await banc.en({ id: F }, "insert into public.formations_parcours (formation_id, parcours_id) values ($1, $2)", [MA, parcours]);
  });

  it("il ne touche pas aux formations d'un autre (rien ne change)", async () => {
    expect(await banc.en({ id: F }, "update public.formations set titre = 'Piraté' where id = $1 returning id", [AUTRE])).toEqual([]);
    await expect(banc.en({ id: F }, "insert into public.modules (formation_id, titre) values ($1, 'Intrus')", [AUTRE])).rejects.toThrow(REFUS);
    expect(await banc.en({ id: F }, "delete from public.formations where id = $1 returning id", [AUTRE])).toEqual([]);
  });

  it("il ne change ni l'état ni les réglages de l'équipe", async () => {
    const essais: [string, unknown][] = [
      ["statut", "publiee"],
      ["gratuite", true],
      ["achat_separe", true],
      ["prix_fcfa", 100],
      ["badge", "nouveau"],
      ["seuil_video", 80],
      ["formateur_id", FB],
      ["envoyee_le", new Date().toISOString()],
      ["renvoyee_le", new Date().toISOString()],
      ["remarque_relecture", "x"],
      ["modifiee_par_formateur_le", new Date().toISOString()],
      ["note_moyenne", 4.5],
      ["nb_avis", 3],
    ];
    for (const [colonne, valeur] of essais) {
      await expect(banc.en({ id: F }, `update public.formations set ${colonne} = $1 where id = $2`, [valeur, MA]), colonne).rejects.toThrow(REGLAGE);
    }
  });

  it("enregistrer le contenu d'une formation réglée par l'équipe garde ses réglages", async () => {
    await banc.en({ id: F }, "update public.formations set resume = 'Nouveau résumé', titre = 'Publiée' where id = $1", [PUB]);
    expect(await un("select gratuite, prix_fcfa, badge, statut from public.formations where id = $1", [PUB])).toEqual({ gratuite: true, prix_fcfa: 5000, badge: "populaire", statut: "publiee" });
  });

  it("après la mise en ligne, toute modification du formateur est datée ; pas avant, pas par l'équipe", async () => {
    const date = async (id: string) => (await un<{ d: string | null }>("select modifiee_par_formateur_le::text as d from public.formations where id = $1", [id])).d;
    expect(await date(PUB)).not.toBeNull();
    await banc.db.query("update public.formations set modifiee_par_formateur_le = null where id = $1", [PUB]);
    await banc.en({ id: F }, "insert into public.modules (formation_id, titre) values ($1, 'Bonus')", [PUB]);
    expect(await date(PUB)).not.toBeNull();
    expect(await date(MA)).toBeNull();
    await banc.db.query("update public.formations set modifiee_par_formateur_le = null where id = $1", [PUB]);
    await banc.en({ id: A }, "update public.formations set resume = 'Par l’équipe' where id = $1", [PUB]);
    expect(await date(PUB)).toBeNull();
  });

  it("l'avis d'un étudiant recalcule toujours la note d'une formation de formateur", async () => {
    await banc.db.query(
      `insert into public.progression_lecons (profil_id, lecon_id, terminee_le)
       select $1, l.id, now() from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $2`,
      [E, PUB],
    );
    await banc.en({ id: E }, "select public.enregistrer_avis($1, 4::smallint, 'Bien')", [PUB]);
    expect(await un("select note_moyenne::float as n, nb_avis from public.formations where id = $1", [PUB])).toEqual({ n: 4, nb_avis: 1 });
  });

  it("il lit les leçons de ses brouillons ; un autre formateur et un étudiant non", async () => {
    const acces = async (qui: string) => (await banc.en<{ a: boolean }>({ id: qui }, "select public.acces_lecon($1) as a", [leconMA]))[0].a;
    expect(await acces(F)).toBe(true);
    expect(await acces(G)).toBe(false);
    expect(await acces(E)).toBe(false);
    expect(await banc.en({ id: F }, "select lecon_id from public.lecons_contenus where lecon_id = $1", [leconMA])).toEqual([{ lecon_id: leconMA }]);
  });

  it("stockage : il liste, dépose et supprime dans le dossier de ses formations seulement", async () => {
    const deposer = (qui: string, espace: string, nom: string) =>
      banc.en({ id: qui }, "insert into storage.objects (bucket_id, name) values ($1, $2) returning name", [espace, nom]);
    for (const espace of ["couvertures", "ressources"]) {
      const nom = `${MA}/${randomUUID()}.${espace === "couvertures" ? "jpg" : "pdf"}`;
      expect(await deposer(F, espace, nom)).toEqual([{ name: nom }]);
      expect(await banc.en({ id: F }, "select name from storage.objects where bucket_id = $1 and name = $2", [espace, nom])).toEqual([{ name: nom }]);
      expect(await banc.en({ id: F }, "delete from storage.objects where bucket_id = $1 and name = $2 returning name", [espace, nom])).toEqual([{ name: nom }]);
      await expect(deposer(F, espace, `${AUTRE}/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
      await expect(deposer(F, espace, `pas-un-uuid/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
      await expect(deposer(E, espace, `${MA}/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
    }
  });

  it("l'équipe n'est pas gênée : elle règle et réattribue ; l'ancien formateur perd aussitôt la formation", async () => {
    await banc.en({ id: A }, "update public.formations set prix_fcfa = 7000 where id = $1", [PUB]);
    await banc.en({ id: A }, "update public.formations set formateur_id = $1 where id = $2", [FB, MA]);
    expect(await banc.en({ id: F }, "select id from public.formations where id = $1", [MA])).toEqual([]);
    expect(await banc.en({ id: F }, "update public.formations set titre = 'Encore' where id = $1 returning id", [MA])).toEqual([]);
    await expect(banc.en({ id: F }, "insert into public.modules (formation_id, titre) values ($1, 'Intrus')", [MA])).rejects.toThrow(REFUS);
    expect(await banc.en({ id: G }, "select id from public.formations where id = $1", [MA])).toEqual([{ id: MA }]);
    await banc.en({ id: A }, "update public.formations set formateur_id = $1 where id = $2", [FA, MA]);
  });

  it("une seule règle de lecture par table de contenu ; la migration est rejouable", async () => {
    const lignes = await banc.db.query<{ t: string; n: number }>(
      `select tablename as t, count(*)::int as n from pg_policies
       where schemaname = 'public' and cmd = 'SELECT'
         and tablename in ('parcours', 'formateurs', 'formations', 'formations_parcours', 'modules', 'lecons', 'lecons_contenus', 'ressources')
       group by tablename`,
    );
    expect(lignes.rows.every((l) => l.n === 1)).toBe(true);
    await banc.appliquer(MIGRATION);
    expect(await banc.en({ id: F }, "select id from public.formations where id = $1", [MA])).toEqual([{ id: MA }]);
  });
});
