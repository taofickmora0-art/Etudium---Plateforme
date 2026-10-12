import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { FORMATS } from "@/lib/admin/fichiers";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0005 : outils du back-office (ordre des éléments, formats acceptés par l'espace « ressources »).
const MIGRATION = "supabase/migrations/0005_back_office.sql";

describe("Migration 0005 : back-office", () => {
  let banc: Banc;
  const A = randomUUID();
  const E = randomUUID();
  let module1: string;

  const titresDuModule = async (moduleId: string) =>
    (await banc.db.query<{ titre: string }>("select titre from public.lecons where module_id = $1 order by ordre", [moduleId])).rows.map((r) => r.titre);
  const idLecon = async (titre: string) => (await banc.db.query<{ id: string }>("select id from public.lecons where titre = $1", [titre])).rows[0].id;

  beforeAll(async () => {
    banc = await creerBanc([...MIGRATIONS_LOT_0, "supabase/migrations/0004_contenus.sql", MIGRATION, "supabase/exemples/lot-1.sql"]);
    await banc.creerCompte(A, ["admin"]);
    await banc.creerCompte(E);
    module1 = (
      await banc.db.query<{ id: string }>(
        "select m.id from public.modules m join public.formations f on f.id = m.formation_id where f.slug = 'maitriser-microsoft-excel' and m.ordre = 1",
      )
    ).rows[0].id;
  });

  it("monter une leçon l'échange avec la précédente", async () => {
    await banc.en({ id: A }, "select public.deplacer('lecons', $1, -1)", [await idLecon("Saisir et mettre en forme des données")]);
    expect((await titresDuModule(module1)).slice(0, 2)).toEqual(["Saisir et mettre en forme des données", "Découvrir l’interface"]);
    await banc.en({ id: A }, "select public.deplacer('lecons', $1, 1)", [await idLecon("Saisir et mettre en forme des données")]);
    expect((await titresDuModule(module1)).slice(0, 2)).toEqual(["Découvrir l’interface", "Saisir et mettre en forme des données"]);
  });

  it("au bord, rien ne bouge", async () => {
    const avant = await titresDuModule(module1);
    await banc.en({ id: A }, "select public.deplacer('lecons', $1, -1)", [await idLecon("Découvrir l’interface")]);
    await banc.en({ id: A }, "select public.deplacer('lecons', $1, 1)", [await idLecon("Références relatives et absolues")]);
    expect(await titresDuModule(module1)).toEqual(avant);
  });

  it("des ordres en double sont renumérotés", async () => {
    const formation = (await banc.db.query<{ id: string }>("select id from public.formations where slug = 'zotero-gerer-ses-references'")).rows[0].id;
    // Même ordre partout : la date de création départage.
    await banc.db.query(
      "insert into public.modules (formation_id, titre, ordre, cree_le) values ($1, 'Premier', 1, now() - interval '3 minutes'), ($1, 'Second', 1, now() - interval '2 minutes'), ($1, 'Troisième', 1, now() - interval '1 minute')",
      [formation],
    );
    const troisieme = (await banc.db.query<{ id: string }>("select id from public.modules where titre = 'Troisième'")).rows[0].id;
    await banc.en({ id: A }, "select public.deplacer('modules', $1, -1)", [troisieme]);
    const { rows } = await banc.db.query<{ titre: string; ordre: number }>("select titre, ordre from public.modules where formation_id = $1 order by ordre", [
      formation,
    ]);
    expect(rows.map((r) => r.ordre)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.titre)).toEqual(["Premier", "Troisième", "Second"]);
  });

  it("un étudiant ne réordonne rien", async () => {
    const avant = await titresDuModule(module1);
    await banc.en({ id: E }, "select public.deplacer('lecons', $1, -1)", [await idLecon("Les formules essentielles")]);
    expect(await titresDuModule(module1)).toEqual(avant);
  });

  it("une table non prévue ou un sens inconnu est refusé", async () => {
    const formation = (await banc.db.query<{ id: string }>("select id from public.formations limit 1")).rows[0].id;
    await expect(banc.en({ id: A }, "select public.deplacer('formations', $1, 1)", [formation])).rejects.toThrow(/Table non prévue/);
    await expect(banc.en({ id: A }, "select public.deplacer('lecons', $1, 2)", [await idLecon("Les formules essentielles")])).rejects.toThrow(
      /Sens de déplacement/,
    );
  });

  it("l'espace ressources n'accepte que les formats prévus, les mêmes que l'application", async () => {
    const [{ allowed_mime_types }] = (
      await banc.db.query<{ allowed_mime_types: string[] }>("select allowed_mime_types from storage.buckets where id = 'ressources'")
    ).rows;
    expect([...allowed_mime_types].sort()).toEqual(FORMATS.map((f) => f.mime).sort());
    expect(allowed_mime_types).not.toContain("application/x-msdownload");
  });

  it("la migration se rejoue", async () => {
    await banc.appliquer(MIGRATION);
    expect((await titresDuModule(module1)).length).toBe(4);
  });
});
