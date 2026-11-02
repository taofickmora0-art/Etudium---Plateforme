import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua } from "./banc";

// Point reporté du lot 4 : une formation déjà en ligne quand la migration 0057 est appliquée reçoit une version de
// départ (son historique commence là) ; rejouer la migration n'en ajoute pas d'autre.

describe("Migration 0057 : la version de départ", () => {
  it("les formations en ligne en reçoivent une, les brouillons non ; rejouée, rien de plus", async () => {
    const banc = await creerBanc(migrationsJusqua("0056"));
    const enLigne = (await banc.db.query<{ id: string }>("insert into public.formations (titre, slug, statut) values ('Excel', $1, 'publiee') returning id", [randomUUID()])).rows[0].id;
    await banc.db.query("insert into public.formations (titre, slug) values ('Brouillon', $1)", [randomUUID()]);
    await banc.appliquer("supabase/migrations/0057_versions_formations.sql");
    const versions = async () =>
      (await banc.db.query<{ formation_id: string; numero: number; resume: string }>("select formation_id, numero, resume from public.versions_formations")).rows;
    expect(await versions()).toEqual([{ formation_id: enLigne, numero: 1, resume: "Version de départ" }]);
    await banc.appliquer("supabase/migrations/0057_versions_formations.sql");
    expect(await versions()).toHaveLength(1);
  });

  it("restaurer dit si la formation est en ligne (la restauration passe alors par le brouillon)", async () => {
    const banc = await creerBanc(migrationsJusqua("0057"));
    const S = randomUUID();
    await banc.creerCompte(S, ["super_admin"]);
    const formation = (await banc.db.query<{ id: string }>("insert into public.formations (titre, slug) values ('Excel', $1) returning id", [randomUUID()])).rows[0].id;
    await banc.en({ id: S }, "update public.formations set statut = 'publiee' where id = $1", [formation]);
    const version = (await banc.db.query<{ id: string }>("select id from public.versions_formations where formation_id = $1", [formation])).rows[0].id;
    const r = (await banc.en<{ r: { en_ligne: boolean } }>({ id: S }, "select public.restaurer_version($1) as r", [version]))[0].r;
    expect(r.en_ligne).toBe(true);
  });
});
