import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0006 : notes privées d'une leçon (spec du lot 1, §4 `notes_lecons`).
const MIGRATION = "supabase/migrations/0006_notes.sql";

describe("Migration 0006 : notes privées", () => {
  let banc: Banc;
  const E = randomUUID();
  const F = randomUUID();
  let apercu: string;
  let gratuite: string;
  let payante: string;

  const idLecon = async (titre: string) => (await banc.db.query<{ id: string }>("select id from public.lecons where titre = $1", [titre])).rows[0].id;
  const notesDe = (qui: string) => banc.en<{ lecon_id: string; texte: string }>({ id: qui }, "select lecon_id, texte from public.notes_lecons");

  beforeAll(async () => {
    banc = await creerBanc([
      ...MIGRATIONS_LOT_0,
      "supabase/migrations/0004_contenus.sql",
      "supabase/migrations/0005_back_office.sql",
      MIGRATION,
      "supabase/exemples/lot-1.sql",
    ]);
    await banc.creerCompte(E);
    await banc.creerCompte(F);
    apercu = await idLecon("Découvrir l’interface");
    payante = await idLecon("Les tableaux croisés dynamiques");
    // Zotero est gratuite mais n'a pas de programme dans les exemples : on lui donne une leçon.
    await banc.db.query(
      "with m as (insert into public.modules (formation_id, titre, ordre) select id, 'Premiers pas', 1 from public.formations where slug = 'zotero-gerer-ses-references' returning id) " +
        "insert into public.lecons (module_id, titre, ordre) select id, 'Installer Zotero', 1 from m",
    );
    gratuite = await idLecon("Installer Zotero");
  });

  it("un étudiant écrit, relit et modifie sa note", async () => {
    await banc.en({ id: E }, "insert into public.notes_lecons (lecon_id, texte) values ($1, 'Ctrl + T')", [apercu]);
    expect(await notesDe(E)).toEqual([{ lecon_id: apercu, texte: "Ctrl + T" }]);
    await banc.en(
      { id: E },
      "insert into public.notes_lecons (lecon_id, texte) values ($1, 'Première') on conflict (profil_id, lecon_id) do update set texte = excluded.texte",
      [gratuite],
    );
    await banc.en(
      { id: E },
      "insert into public.notes_lecons (lecon_id, texte) values ($1, 'Seconde') on conflict (profil_id, lecon_id) do update set texte = excluded.texte",
      [gratuite],
    );
    expect((await notesDe(E)).find((n) => n.lecon_id === gratuite)?.texte).toBe("Seconde");
  });

  it("un autre compte ne voit, ne modifie ni n'efface les notes d'un autre", async () => {
    expect(await notesDe(F)).toEqual([]);
    expect(await banc.en({ id: F }, "update public.notes_lecons set texte = 'piraté' returning lecon_id")).toEqual([]);
    expect(await banc.en({ id: F }, "delete from public.notes_lecons returning lecon_id")).toEqual([]);
    await expect(banc.en({ id: F }, "insert into public.notes_lecons (profil_id, lecon_id, texte) values ($1, $2, 'usurpée')", [E, apercu])).rejects.toThrow();
    expect((await notesDe(E)).find((n) => n.lecon_id === apercu)?.texte).toBe("Ctrl + T");
  });

  it("un visiteur ne lit ni n'écrit aucune note", async () => {
    await expect(banc.en("anon", "select * from public.notes_lecons")).rejects.toThrow();
    await expect(banc.en("anon", "insert into public.notes_lecons (lecon_id, texte) values ($1, 'x')", [apercu])).rejects.toThrow();
  });

  it("une note sur une leçon fermée est refusée", async () => {
    await expect(banc.en({ id: E }, "insert into public.notes_lecons (lecon_id, texte) values ($1, 'x')", [payante])).rejects.toThrow();
  });

  it("une note vide ou de plus de 5 000 caractères est refusée", async () => {
    await expect(banc.en({ id: F }, "insert into public.notes_lecons (lecon_id, texte) values ($1, '')", [apercu])).rejects.toThrow();
    await expect(banc.en({ id: F }, "insert into public.notes_lecons (lecon_id, texte) values ($1, $2)", [apercu, "a".repeat(5001)])).rejects.toThrow();
    await banc.en({ id: F }, "insert into public.notes_lecons (lecon_id, texte) values ($1, $2)", [apercu, "a".repeat(5000)]);
  });

  it("la migration se rejoue sans perdre les notes", async () => {
    await banc.appliquer(MIGRATION);
    expect((await notesDe(E)).find((n) => n.lecon_id === apercu)?.texte).toBe("Ctrl + T");
  });

  it("supprimer une leçon efface ses notes", async () => {
    await banc.db.query("delete from public.lecons where id = $1", [gratuite]);
    expect((await notesDe(E)).map((n) => n.lecon_id)).not.toContain(gratuite);
  });
});
