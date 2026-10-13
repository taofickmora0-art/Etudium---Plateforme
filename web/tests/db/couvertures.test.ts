import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0012 : image de couverture des formations (colonne et espace de stockage public « couvertures »).
const MIGRATION = "supabase/migrations/0012_couvertures.sql";
const REFUS = /row-level security|permission denied/;

describe("Migration 0012 : images de couverture", () => {
  let banc: Banc;
  const E = randomUUID();
  const A = randomUUID();
  let excel: string;
  let zotero: string;

  const deposer = (qui: "anon" | { id: string }, nom: string) =>
    banc.en(qui, "insert into storage.objects (bucket_id, name) values ('couvertures', $1) returning name", [nom]);

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
      MIGRATION,
    ]);
    await banc.creerCompte(E);
    await banc.creerCompte(A, ["admin"]);
    const id = async (slug: string) => (await banc.db.query<{ id: string }>("select id from public.formations where slug = $1", [slug])).rows[0].id;
    excel = await id("maitriser-microsoft-excel");
    zotero = await id("zotero-gerer-ses-references");
  });

  it("l'équipe dépose une image dans le dossier d'une formation ; un étudiant et un visiteur sont refusés", async () => {
    const nom = `${excel}/${randomUUID()}.jpg`;
    expect(await deposer({ id: A }, nom)).toEqual([{ name: nom }]);
    await expect(deposer({ id: E }, `${excel}/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
    await expect(deposer("anon", `${excel}/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
  });

  it("le premier dossier doit être une formation existante", async () => {
    await expect(deposer({ id: A }, `pas-une-formation/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
    await expect(deposer({ id: A }, `${randomUUID()}/${randomUUID()}.jpg`)).rejects.toThrow(REFUS);
  });

  it("tout le monde lit les couvertures ; seule l'équipe supprime", async () => {
    const nom = `${zotero}/${randomUUID()}.png`;
    await deposer({ id: A }, nom);
    expect(await banc.en("anon", "select name from storage.objects where bucket_id = 'couvertures' and name = $1", [nom])).toEqual([{ name: nom }]);
    expect(await banc.en({ id: E }, "delete from storage.objects where bucket_id = 'couvertures' and name = $1 returning name", [nom])).toEqual([]);
    expect(await banc.en({ id: A }, "delete from storage.objects where bucket_id = 'couvertures' and name = $1 returning name", [nom])).toEqual([{ name: nom }]);
  });

  it("la colonne n'accepte qu'un fichier du dossier de sa formation, en JPG, PNG ou WebP", async () => {
    const bon = `${excel}/${randomUUID()}.webp`;
    await banc.db.query("update public.formations set couverture = $2 where id = $1", [excel, bon]);
    expect((await banc.db.query<{ couverture: string }>("select couverture from public.formations where id = $1", [excel])).rows[0].couverture).toBe(bon);
    await expect(banc.db.query("update public.formations set couverture = $2 where id = $1", [excel, `${zotero}/${randomUUID()}.jpg`])).rejects.toThrow(/formations_couverture_chemin/);
    await expect(banc.db.query("update public.formations set couverture = $2 where id = $1", [excel, `${excel}/${randomUUID()}.gif`])).rejects.toThrow(/formations_couverture_chemin/);
    await banc.db.query("update public.formations set couverture = null where id = $1", [excel]);
  });

  it("l'espace est public, limité à 5 Mo et aux images JPG, PNG et WebP ; la migration se rejoue", async () => {
    await banc.appliquer(MIGRATION);
    const { rows } = await banc.db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'couvertures'",
    );
    expect({ ...rows[0], file_size_limit: Number(rows[0].file_size_limit) }).toEqual({ public: true, file_size_limit: 5242880, allowed_mime_types: ["image/jpeg", "image/png", "image/webp"] });
  });
});
