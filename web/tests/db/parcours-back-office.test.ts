import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, creerParcours, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0065 : les chiffres de la page Parcours du back-office (demande du 2 novembre 2026, option A) : par parcours,
// les formations publiées et en brouillon, les apprenants (comptes étudiants qui ont commencé une de ses formations) et
// les certificats ; et les totaux du haut de page.

let banc: Banc;
const [A, M, E1, E2, E3, F] = Array.from({ length: 6 }, () => randomUUID());
let P1: string;
let P2: string;
let P3: string;
const f: Record<string, FormationTest> = {};

type Stats = {
  totaux: { parcours_actifs: number; formations_publiees: number; apprenants: number; certificats: number };
  parcours: { id: string; formations_publiees: number; formations_brouillons: number; apprenants: number; certificats: number }[];
};
const stats = async (qui: string) => (await banc.en<{ s: Stats }>({ id: qui }, "select public.parcours_back_office() as s"))[0].s;
const ouvrir = (qui: string, formation: FormationTest) =>
  banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2) on conflict do nothing", [qui, formation.lecons[0]]);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0065"));
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(M, ["moderateur"]);
  await banc.creerCompte(F, ["formateur"]);
  for (const id of [E1, E2, E3]) await banc.creerCompte(id);
  P1 = await creerParcours(banc, "Réussite académique");
  P2 = await creerParcours(banc, "Compétences digitales", "digital");
  P3 = await creerParcours(banc, "Ancien");
  await banc.db.query("update public.parcours set actif = false where id = $1", [P3]);
  const sans = { quiz: false, exercice: null } as const;
  f.word = await creerFormation(banc, "Word", { ...sans, parcours: [P1] });
  f.zotero = await creerFormation(banc, "Zotero", { ...sans, parcours: [P1, P2] });
  f.brouillon = await creerFormation(banc, "Mémoire", { ...sans, parcours: [P1], statut: "brouillon" });
  f.canva = await creerFormation(banc, "Canva", { ...sans, parcours: [P2] });
  // Apprenants : E1 dans Word et Zotero (compté une fois par parcours), E2 dans Canva ; l'admin ne compte pas.
  await ouvrir(E1, f.word);
  await ouvrir(E1, f.zotero);
  await ouvrir(E2, f.canva);
  await ouvrir(A, f.word);
  await poserCertificat(banc, E1, f.word);
  await poserCertificat(banc, E3, f.zotero);
}, 60_000);

describe("Migration 0065 : les chiffres des parcours", () => {
  it("par parcours : formations publiées et en brouillon, apprenants étudiants, certificats", async () => {
    const s = await stats(A);
    const de = (id: string) => s.parcours.find((p) => p.id === id);
    expect(de(P1)).toEqual({ id: P1, formations_publiees: 2, formations_brouillons: 1, apprenants: 1, certificats: 2 });
    expect(de(P2)).toEqual({ id: P2, formations_publiees: 2, formations_brouillons: 0, apprenants: 2, certificats: 1 });
    expect(de(P3)).toEqual({ id: P3, formations_publiees: 0, formations_brouillons: 0, apprenants: 0, certificats: 0 });
  });

  it("les totaux : une formation de deux parcours ne compte qu'une fois, un apprenant aussi", async () => {
    expect((await stats(A)).totaux).toEqual({ parcours_actifs: 2, formations_publiees: 3, apprenants: 2, certificats: 2 });
  });

  it("réservé à l'équipe des contenus", async () => {
    for (const qui of [M, F, E1]) await expect(stats(qui)).rejects.toThrow();
    await expect(banc.en("anon", "select public.parcours_back_office()")).rejects.toThrow();
  });
});
