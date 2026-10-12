import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0004 : contenus du lot 1 et règle d'accès (spec du lot 1, §3 et §4), exécutée pour de vrai sur le banc.
const MIGRATION = "supabase/migrations/0004_contenus.sql";
const id = () => randomUUID();

describe("Migration 0004 : contenus et règle d'accès", () => {
  let banc: Banc;
  const E = id(); // étudiant
  const A = id(); // admin
  const M = id(); // modérateur
  const F = id(); // formateur (ses droits de saisie arrivent au lot 4)
  const f = { G: id(), P: id(), B: id(), R: id() };
  const m = { G: id(), P: id(), B: id(), R: id() };
  const l = { g1: id(), g2: id(), p1: id(), p2: id(), b1: id(), r1: id() };
  const parcours = id();

  const formation = (fid: string, slug: string, statut: string, gratuite: boolean) =>
    banc.db.query("insert into public.formations (id, slug, titre, statut, gratuite) values ($1, $2, $3, $4::public.statut_formation, $5)", [
      fid,
      slug,
      `Formation ${slug}`,
      statut,
      gratuite,
    ]);
  const lecon = (lid: string, mid: string, ordre: number, apercu = false) =>
    banc.db.query("insert into public.lecons (id, module_id, titre, ordre, apercu) values ($1, $2, $3, $4, $5)", [lid, mid, `Leçon ${ordre}`, ordre, apercu]);
  const video = (lid: string) =>
    banc.db.query("insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id) values ($1, 'youtube', 'dQw4w9WgXcQ')", [lid]);

  beforeAll(async () => {
    banc = await creerBanc([...MIGRATIONS_LOT_0, MIGRATION]);
    await banc.creerCompte(E);
    await banc.creerCompte(A, ["admin"]);
    await banc.creerCompte(M, ["moderateur"]);
    await banc.creerCompte(F, ["formateur"]);

    await banc.db.query("insert into public.parcours (id, slug, nom, nom_court, couleur) values ($1, 'test', 'Parcours test', 'Test', 'academique')", [parcours]);
    await formation(f.G, "gratuite-g", "publiee", true);
    await formation(f.P, "payante-p", "publiee", false);
    await formation(f.B, "brouillon-b", "brouillon", true);
    await formation(f.R, "archivee-r", "archivee", true);
    for (const cle of ["G", "P", "B", "R"] as const) {
      await banc.db.query("insert into public.modules (id, formation_id, titre, ordre) values ($1, $2, 'Module', 1)", [m[cle], f[cle]]);
    }
    await lecon(l.g1, m.G, 1);
    await lecon(l.g2, m.G, 2);
    await lecon(l.p1, m.P, 1, true);
    await lecon(l.p2, m.P, 2);
    await lecon(l.b1, m.B, 1);
    await lecon(l.r1, m.R, 1);
    for (const lid of Object.values(l)) await video(lid);
    await banc.db.query(
      "insert into public.ressources (lecon_id, titre, fichier, format, taille_octets, telechargeable) values ($1, 'Guide', 'payante-p/guide.pdf', 'application/pdf', 1000, false)",
      [l.p2],
    );
    for (const [lid, fichier] of [
      [l.r1, "archivee-r/fiche.pdf"],
      [l.b1, "brouillon-b/fiche.pdf"],
    ]) {
      await banc.db.query(
        "insert into public.ressources (lecon_id, titre, fichier, format, taille_octets) values ($1, 'Fiche', $2, 'application/pdf', 1000)",
        [lid, fichier],
      );
    }
    await banc.db.query(
      "insert into storage.objects (bucket_id, name) values ('ressources', 'payante-p/guide.pdf'), ('ressources', 'orphelin.pdf'), ('ressources', 'archivee-r/fiche.pdf'), ('ressources', 'brouillon-b/fiche.pdf')",
    );
    await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id) values ($1, $3), ($2, $3)", [f.B, f.G, parcours]);
  });

  const REFUS = /row-level security|permission denied/;

  it("un visiteur voit le catalogue publié, pas les brouillons ni les archives", async () => {
    const slugs = (await banc.en<{ slug: string }>("anon", "select slug from public.formations order by slug")).map((r) => r.slug);
    expect(slugs).toEqual(["gratuite-g", "payante-p"]);
  });

  it("un brouillon ne se devine pas par ses modules ou ses leçons", async () => {
    expect(await banc.en("anon", "select id from public.modules where formation_id = $1", [f.B])).toEqual([]);
    expect(await banc.en("anon", "select id from public.lecons where module_id = $1", [m.B])).toEqual([]);
    expect(await banc.en({ id: E }, "select id from public.lecons where module_id = $1", [m.B])).toEqual([]);
    expect(await banc.en("anon", "select parcours_id from public.formations_parcours where formation_id = $1", [f.B])).toEqual([]);
    expect(await banc.en({ id: E }, "select id from public.ressources where lecon_id = $1", [l.b1])).toEqual([]);
    expect(await banc.en({ id: E }, "select name from storage.objects where name = 'brouillon-b/fiche.pdf'")).toEqual([]);
    expect(await banc.en("anon", "select parcours_id from public.formations_parcours where formation_id = $1", [f.G])).toHaveLength(1);
  });

  it("l'aperçu se regarde sans compte", async () => {
    expect(await banc.en("anon", "select lecon_id from public.lecons_contenus")).toEqual([{ lecon_id: l.p1 }]);
  });

  it("une formation gratuite demande un compte", async () => {
    const sql = "select lecon_id from public.lecons_contenus where lecon_id = any($1) order by lecon_id";
    expect(await banc.en("anon", sql, [[l.g1, l.g2]])).toEqual([]);
    expect(await banc.en({ id: E }, sql, [[l.g1, l.g2]])).toHaveLength(2);
  });

  it("une formation payante reste verrouillée jusqu'au lot 2", async () => {
    const lecons = await banc.en({ id: E }, "select l.id, public.accessible(l) as accessible from public.lecons l where module_id = $1 order by ordre", [m.P]);
    expect(lecons).toEqual([
      { id: l.p1, accessible: true },
      { id: l.p2, accessible: false },
    ]);
    expect(await banc.en({ id: E }, "select lecon_id from public.lecons_contenus where lecon_id = any($1)", [[l.p1, l.p2]])).toEqual([{ lecon_id: l.p1 }]);
    expect(await banc.en({ id: E }, "select id from public.ressources where lecon_id = $1", [l.p2])).toEqual([]);
  });

  it("une formation archivée ferme ses leçons", async () => {
    expect(await banc.en({ id: E }, "select id from public.lecons where id = $1", [l.r1])).toEqual([]);
    expect(await banc.en({ id: E }, "select lecon_id from public.lecons_contenus where lecon_id = $1", [l.r1])).toEqual([]);
    expect(await banc.en({ id: A }, "select id from public.lecons where id = $1", [l.r1])).toHaveLength(1);
    expect(await banc.en({ id: A }, "select lecon_id from public.lecons_contenus where lecon_id = $1", [l.r1])).toHaveLength(1);
    expect(await banc.en({ id: E }, "select id from public.ressources where lecon_id = $1", [l.r1])).toEqual([]);
    expect(await banc.en({ id: E }, "select name from storage.objects where name = 'archivee-r/fiche.pdf'")).toEqual([]);
    expect(await banc.en({ id: A }, "select name from storage.objects where name = 'archivee-r/fiche.pdf'")).toHaveLength(1);
  });

  it("l'équipe voit et saisit tout, le formateur pas encore", async () => {
    const ajout = (slug: string) => `insert into public.parcours (slug, nom, nom_court, couleur) values ('${slug}', 'Nouveau', 'Nouveau', 'digital')`;
    await banc.en({ id: A }, ajout("par-admin"));
    await banc.en({ id: M }, ajout("par-moderateur"));
    await expect(banc.en({ id: E }, ajout("par-etudiant"))).rejects.toThrow(REFUS);
    await expect(banc.en({ id: F }, ajout("par-formateur"))).rejects.toThrow(REFUS);
    await expect(banc.en("anon", ajout("par-visiteur"))).rejects.toThrow(REFUS);
    expect(await banc.en({ id: A }, "select slug from public.formations where slug = 'brouillon-b'")).toHaveLength(1);
    // Le formateur ne touche pas non plus aux leçons ni aux fichiers (lot 4).
    expect(await banc.en({ id: F }, "update public.lecons_contenus set texte = 'modifié' where lecon_id = $1 returning lecon_id", [l.g1])).toEqual([]);
    await expect(banc.en({ id: F }, "insert into storage.objects (bucket_id, name) values ('ressources', 'formateur.pdf')")).rejects.toThrow(REFUS);
  });

  it("personne ne vide une table par l'API", async () => {
    for (const qui of ["anon", { id: E }, { id: F }] as const) {
      await expect(banc.en(qui, "truncate public.formations_parcours")).rejects.toThrow(/permission denied/);
    }
  });

  it("une seule règle de lecture par table, et des liens indexés (conseiller de Supabase)", async () => {
    const tables = ["parcours", "formateurs", "formations", "formations_parcours", "modules", "lecons", "lecons_contenus", "ressources"];
    const { rows } = await banc.db.query<{ tablename: string; cmd: string }>(
      "select tablename, cmd from pg_policies where schemaname = 'public' and tablename = any($1)",
      [tables],
    );
    for (const table of tables) {
      const regles = rows.filter((r) => r.tablename === table).map((r) => r.cmd);
      expect(regles.filter((c) => c === "SELECT" || c === "ALL"), table).toEqual(["SELECT"]);
    }
    const index = (await banc.db.query<{ indexdef: string }>("select indexdef from pg_indexes where schemaname = 'public'")).rows.map((r) => r.indexdef);
    expect(index.some((d) => /ON public\.formations .*\(formateur_id\)/.test(d))).toBe(true);
    expect(index.some((d) => /ON public\.formateurs .*\(compte_id\)/.test(d))).toBe(true);
  });

  it("un fichier de ressource ne s'ouvre qu'avec l'accès à la leçon", async () => {
    const sql = "select name from storage.objects where bucket_id = 'ressources' and name = $1";
    expect(await banc.en({ id: A }, sql, ["payante-p/guide.pdf"])).toHaveLength(1);
    expect(await banc.en({ id: E }, sql, ["payante-p/guide.pdf"])).toEqual([]);
    expect(await banc.en("anon", sql, ["payante-p/guide.pdf"])).toEqual([]);
    expect(await banc.en({ id: E }, sql, ["orphelin.pdf"])).toEqual([]);
    expect(await banc.en({ id: A }, sql, ["orphelin.pdf"])).toHaveLength(1);
    await expect(banc.en({ id: E }, "insert into storage.objects (bucket_id, name) values ('ressources', 'pirate.pdf')")).rejects.toThrow(REFUS);
  });

  it("une adresse de formation n'a ni point ni majuscule", async () => {
    for (const slug of ["node.js", "Excel", "excel-", "-excel", "excel--avance", "éxcel"]) {
      await expect(formation(id(), slug, "brouillon", false), slug).rejects.toThrow(/formations_slug_format/);
    }
    await formation(id(), "node-js", "brouillon", false);
  });

  it("le lien vidéo correspond au fournisseur", async () => {
    const essai = async (fournisseur: string | null, video: string | null) => {
      const lid = id();
      await lecon(lid, m.G, 9);
      return banc.db.query("insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id) values ($1, $2::public.fournisseur_video, $3)", [lid, fournisseur, video]);
    };
    await expect(essai("youtube", "abc")).rejects.toThrow(/lecons_contenus_video/);
    await expect(essai("vimeo", "dQw4w9WgXcQ")).rejects.toThrow(/lecons_contenus_video/);
    await expect(essai("youtube", null)).rejects.toThrow(/lecons_contenus_video/);
    await expect(essai(null, "dQw4w9WgXcQ")).rejects.toThrow(/lecons_contenus_video/);
    await essai("youtube", "dQw4w9WgXcQ");
    await essai("vimeo", "76979871");
    // Vidéo Vimeo « non répertoriée » : son code suit l'identifiant, comme dans son lien (vimeo.com/76979871/abcdef0123).
    await essai("vimeo", "76979871/abcdef0123");
    await expect(essai("vimeo", "76979871/xyz")).rejects.toThrow(/lecons_contenus_video/);
    await essai(null, null);
  });

  it("une ressource en consultation seule est un PDF ou une image", async () => {
    const ajout = (format: string, fichier: string) =>
      banc.db.query("insert into public.ressources (lecon_id, titre, fichier, format, taille_octets, telechargeable) values ($1, 'Fichier', $2, $3, 10, false)", [
        l.g1,
        fichier,
        format,
      ]);
    await expect(ajout("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "g/donnees.xlsx")).rejects.toThrow(/ressources_consultation_format/);
    await ajout("application/pdf", "g/guide.pdf");
    await ajout("image/webp", "g/schema.webp");
  });

  it("une formation publiée garde son adresse et s'archive au lieu de s'effacer", async () => {
    const publiee = id();
    await formation(publiee, "a-publier", "brouillon", false);
    await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [publiee]);
    const [{ publiee_le }] = (await banc.db.query<{ publiee_le: Date | null }>("select publiee_le from public.formations where id = $1", [publiee])).rows;
    expect(publiee_le).not.toBeNull();
    await expect(banc.db.query("update public.formations set slug = 'autre-adresse' where id = $1", [publiee])).rejects.toThrow(
      "L'adresse d'une formation publiée ne change plus.",
    );
    // Effacer la date de publication ne rouvre pas l'adresse.
    await banc.db.query("update public.formations set publiee_le = null where id = $1", [publiee]);
    const [apres] = (await banc.db.query<{ publiee_le: Date | null }>("select publiee_le from public.formations where id = $1", [publiee])).rows;
    expect(apres.publiee_le).toEqual(publiee_le);
    await banc.db.query("update public.formations set statut = 'archivee' where id = $1", [publiee]);
    await expect(banc.db.query("delete from public.formations where id = $1", [publiee])).rejects.toThrow(
      "Une formation publiée s'archive, elle ne s'efface pas.",
    );

    const brouillon = id();
    await formation(brouillon, "simple-brouillon", "brouillon", false);
    await banc.db.query("update public.formations set slug = 'brouillon-renomme' where id = $1", [brouillon]);
    await banc.db.query("delete from public.formations where id = $1", [brouillon]);
  });

  it("une date de publication saisie sur un brouillon est ignorée", async () => {
    const brouillon = id();
    await banc.db.query("insert into public.formations (id, slug, titre, statut, publiee_le) values ($1, 'brouillon-date', 'Brouillon daté', 'brouillon', now())", [brouillon]);
    await banc.db.query("update public.formations set publiee_le = now() where id = $1", [brouillon]);
    const [{ publiee_le }] = (await banc.db.query<{ publiee_le: Date | null }>("select publiee_le from public.formations where id = $1", [brouillon])).rows;
    expect(publiee_le).toBeNull();
    await banc.db.query("update public.formations set slug = 'brouillon-date-renomme' where id = $1", [brouillon]);
    await banc.db.query("delete from public.formations where id = $1", [brouillon]);
  });

  it("la migration se rejoue", async () => {
    const compter = async () => (await banc.db.query<{ n: number }>("select count(*)::int as n from public.formations")).rows[0].n;
    const avant = await compter();
    await banc.appliquer(MIGRATION);
    expect(await compter()).toBe(avant);
    expect(await banc.en("anon", "select lecon_id from public.lecons_contenus")).toEqual([{ lecon_id: l.p1 }]);
  });
});
