import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua } from "./banc";

// Point reporté du lot 4 : une leçon supprimée pendant qu'un autre membre l'a ouverte. Son enregistrement automatique
// reçoit un refus clair (P0001, sans nouvel essai) au lieu d'échouer en boucle.

describe("Migration 0056 : enregistrer une leçon supprimée", () => {
  it("un refus clair, pour l'équipe comme pour le formateur", async () => {
    const banc = await creerBanc(migrationsJusqua("0056"));
    const S = randomUUID();
    await banc.creerCompte(S, ["super_admin"]);
    const formation = (await banc.db.query<{ id: string }>("insert into public.formations (titre, slug) values ('Excel', $1) returning id", [randomUUID()])).rows[0].id;
    const idModule = (await banc.db.query<{ id: string }>("insert into public.modules (formation_id, titre, ordre) values ($1, 'M', 1) returning id", [formation])).rows[0].id;
    const lecon = (await banc.db.query<{ id: string }>("insert into public.lecons (module_id, titre, ordre) values ($1, 'L', 1) returning id", [idModule])).rows[0].id;
    await banc.db.query("delete from public.lecons where id = $1", [lecon]);
    const err = await banc.en({ id: S }, "select public.enregistrer_lecon($1, '{}'::jsonb, 0)", [lecon]).catch((e: { code?: string; message?: string }) => e);
    expect(err).toMatchObject({ code: "P0001", message: "Cette leçon n’existe plus : elle a été supprimée. Revenez au programme de la formation." });
  });
});
