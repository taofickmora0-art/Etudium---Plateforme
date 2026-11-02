import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";

// Migration 0067 : deux indicateurs de plus sur la vue d'ensemble du back-office (choisis le 2 novembre 2026) : le taux
// de conversion (étudiants abonnés sur étudiants inscrits) et les abonnements à renouveler (qui se terminent dans les
// 7 jours, dont ceux déjà renouvelés). Seulement les comptes étudiants : l'équipe et les formateurs ne comptent pas.

let banc: Banc;
const [A, MOD, S1, S2, S3, S4] = Array.from({ length: 6 }, () => randomUUID());

type Complements = { conversion: { abonnes: number; inscrits: number; taux: number | null }; a_renouveler: { total: number; renouveles: number } };
const complements = async (qui: string) => (await banc.en<{ c: Complements }>({ id: qui }, "select public.vue_ensemble_complements() as c"))[0].c;

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0067"));
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(MOD, ["moderateur"]);
  for (const id of [S1, S2, S3, S4]) await banc.creerCompte(id);
  // S1 : se termine dans 3 jours, pas renouvelé ; S2 : dans 5 jours, déjà renouvelé ; S3 : dans 30 jours ; S4 : rien.
  await abonner(banc, S1, { fin: "now() + interval '3 days'" });
  await abonner(banc, S2, { fin: "now() + interval '5 days'" });
  await abonner(banc, S2, { debut: "now() + interval '5 days'", fin: "now() + interval '95 days'" });
  await abonner(banc, S3, { fin: "now() + interval '30 days'" });
  // L'admin abonné, qui finit aussi bientôt, ne compte pas.
  await abonner(banc, A, { fin: "now() + interval '2 days'" });
}, 60_000);

describe("Migration 0067 : les deux indicateurs de plus", () => {
  it("le taux de conversion : étudiants abonnés sur étudiants inscrits", async () => {
    expect((await complements(A)).conversion).toEqual({ abonnes: 3, inscrits: 4, taux: 75 });
  });

  it("les abonnements à renouveler : ceux qui finissent dans les 7 jours, dont ceux déjà renouvelés", async () => {
    expect((await complements(A)).a_renouveler).toEqual({ total: 2, renouveles: 1 });
  });

  it("réservé à qui voit les statistiques", async () => {
    for (const qui of [MOD, S1]) await expect(complements(qui)).rejects.toThrow();
    await expect(banc.en("anon", "select public.vue_ensemble_complements()")).rejects.toThrow();
  });
});
