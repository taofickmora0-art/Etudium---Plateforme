import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0009 : favoris, formations archivées encore visibles pour qui les a commencées (spec §3, R24), et
// correction de la date de première ouverture des lignes antérieures à la 0008.
const MIGRATION = "supabase/migrations/0009_favoris.sql";

describe("Migration 0009 : favoris et formations commencées", () => {
  let banc: Banc;
  const E = randomUUID();
  const F = randomUUID();
  let excel: string;
  let zotero: string;
  let apercu: string;

  const idFormation = async (slug: string) => (await banc.db.query<{ id: string }>("select id from public.formations where slug = $1", [slug])).rows[0].id;
  const favorisDe = (qui: string) => banc.en<{ formation_id: string }>({ id: qui }, "select formation_id from public.favoris order by ajoute_le");

  beforeAll(async () => {
    banc = await creerBanc([
      ...MIGRATIONS_LOT_0,
      "supabase/migrations/0004_contenus.sql",
      "supabase/migrations/0005_back_office.sql",
      "supabase/migrations/0006_notes.sql",
      "supabase/migrations/0007_visionnage.sql",
      "supabase/migrations/0008_progression.sql",
      "supabase/exemples/lot-1.sql",
    ]);
    await banc.creerCompte(E);
    await banc.creerCompte(F);
    excel = await idFormation("maitriser-microsoft-excel");
    zotero = await idFormation("zotero-gerer-ses-references");
    apercu = (await banc.db.query<{ id: string }>("select id from public.lecons where titre = 'Découvrir l’interface'")).rows[0].id;
    // E a ouvert une leçon d'Excel. Sa ligne date d'avant la 0008 : première ouverture postérieure à la dernière visite.
    await banc.en({ id: E }, "select public.ouvrir_lecon($1)", [apercu]);
    await banc.db.query("update public.progression_lecons set vue_le = now() - interval '3 days', ouverte_le = now() where profil_id = $1", [E]);
    await banc.appliquer(MIGRATION);
  });

  it("la première ouverture n'est jamais après la dernière visite (lignes antérieures à la 0008)", async () => {
    const { rows } = await banc.db.query<{ ok: boolean }>("select ouverte_le <= vue_le as ok from public.progression_lecons where profil_id = $1", [E]);
    expect(rows.every((r) => r.ok)).toBe(true);
  });

  it("un étudiant ajoute, relit et retire ses favoris ; un double clic ne crée qu'un favori", async () => {
    await banc.en({ id: E }, "insert into public.favoris (formation_id) values ($1) on conflict do nothing", [excel]);
    await banc.en({ id: E }, "insert into public.favoris (formation_id) values ($1) on conflict do nothing", [excel]);
    await banc.en({ id: E }, "insert into public.favoris (formation_id) values ($1) on conflict do nothing", [zotero]);
    expect((await favorisDe(E)).map((f) => f.formation_id)).toEqual([excel, zotero]);
    await banc.en({ id: E }, "delete from public.favoris where formation_id = $1", [zotero]);
    expect((await favorisDe(E)).map((f) => f.formation_id)).toEqual([excel]);
  });

  it("chacun ses favoris ; un visiteur n'en a pas ; une formation non publiée ne s'ajoute pas", async () => {
    expect(await favorisDe(F)).toEqual([]);
    expect(await banc.en({ id: F }, "delete from public.favoris returning formation_id")).toEqual([]);
    await expect(banc.en("anon", "select * from public.favoris")).rejects.toThrow();
    await banc.db.query("insert into public.formations (slug, titre, statut) values ('brouillon-test', 'Brouillon', 'brouillon')");
    const brouillon = await idFormation("brouillon-test");
    await expect(banc.en({ id: F }, "insert into public.favoris (formation_id) values ($1)", [brouillon])).rejects.toThrow();
  });

  it("une formation archivée reste visible pour qui l'a commencée, leçons fermées ; invisible pour les autres", async () => {
    await banc.db.query("update public.formations set statut = 'archivee' where id = $1", [excel]);
    const vue = (qui: string) => banc.en<{ id: string }>({ id: qui }, "select id from public.formations where id = $1", [excel]);
    expect(await vue(E)).toHaveLength(1);
    expect(await vue(F)).toHaveLength(0);
    const lecons = await banc.en<{ id: string; accessible: boolean }>(
      { id: E },
      "select l.id, public.acces_lecon(l.id) as accessible from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $1",
      [excel],
    );
    expect(lecons.length).toBeGreaterThan(0);
    expect(lecons.every((l) => !l.accessible)).toBe(true);
    // Le favori d'une formation archivée reste en base.
    expect((await favorisDe(E)).map((f) => f.formation_id)).toEqual([excel]);
    await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [excel]);
  });

  it("la migration se rejoue sans perdre les favoris", async () => {
    await banc.appliquer(MIGRATION);
    expect((await favorisDe(E)).map((f) => f.formation_id)).toEqual([excel]);
  });
});
