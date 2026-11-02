import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, poserCertificat, type FormationTest } from "./engagement-banc";

// Migration 0068 : les chiffres des cartes du back-office (demande du 2 novembre 2026 : « reprendre les pages de l'admin
// comme sur l'espace étudiant ») : par formation, ses apprenants, ses certificats et ses exercices à corriger ; par
// formateur, ses formations, ses apprenants, sa note et ses corrections en attente.

let banc: Banc;
const [A, MOD, E1, E2, CF] = Array.from({ length: 5 }, () => randomUUID());
let FA: string;
let FB: string;
const f: Record<string, FormationTest> = {};

type Formations = { apprenants_total: number; formations: { id: string; apprenants: number; certificats: number; a_corriger: number }[] };
type Formateurs = {
  totaux: { formateurs: number; formations_publiees: number; a_corriger: number; note_moyenne: number | null };
  formateurs: { id: string; formations_publiees: number; formations_total: number; apprenants: number; note: number | null; avis: number; a_corriger: number; compte_relie: boolean }[];
};
const formations = async (qui = A) => (await banc.en<{ r: Formations }>({ id: qui }, "select public.formations_back_office() as r"))[0].r;
const formateurs = async (qui = A) => (await banc.en<{ r: Formateurs }>({ id: qui }, "select public.formateurs_back_office() as r"))[0].r;
const ouvrir = (qui: string, formation: FormationTest) =>
  banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2) on conflict do nothing", [qui, formation.lecons[0]]);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0068"));
  await banc.creerCompte(A, ["admin"]);
  await banc.creerCompte(MOD, ["moderateur"]);
  await banc.creerCompte(CF);
  for (const id of [E1, E2]) await banc.creerCompte(id);
  FA = (await banc.db.query<{ id: string }>("insert into public.formateurs (nom, compte_id) values ('Dr Mireille Adjovi', $1) returning id", [CF])).rows[0].id;
  FB = (await banc.db.query<{ id: string }>("insert into public.formateurs (nom) values ('Naïmath Seïdou') returning id")).rows[0].id;
  f.excel = await creerFormation(banc, "Excel", { quiz: false, exercice: "rendu", formateur: FA });
  f.word = await creerFormation(banc, "Word", { quiz: false, exercice: null, formateur: FA });
  f.brouillon = await creerFormation(banc, "Brouillon", { quiz: false, exercice: null, formateur: FA, statut: "brouillon" });
  f.canva = await creerFormation(banc, "Canva", { quiz: false, exercice: null, formateur: FB });
  await ouvrir(E1, f.excel);
  await ouvrir(E2, f.excel);
  await ouvrir(E1, f.word);
  await ouvrir(A, f.canva);
  await poserCertificat(banc, E1, f.word);
  // Un rendu en attente de correction sur Excel.
  await banc.db.query("insert into public.rendus_exercices (lecon_id, profil_id, version) values ($1, $2, 1)", [f.excel.exercice, E2]);
  // Des avis : Excel 4,0 (2 avis), Word 5,0 (1 avis).
  await banc.db.query("update public.formations set note_moyenne = 4.0, nb_avis = 2 where id = $1", [f.excel.id]);
  await banc.db.query("update public.formations set note_moyenne = 5.0, nb_avis = 1 where id = $1", [f.word.id]);
}, 60_000);

describe("Migration 0068 : les chiffres des cartes du back-office", () => {
  it("par formation : apprenants étudiants, certificats, exercices à corriger ; le total des apprenants compté une fois", async () => {
    const r = await formations();
    const de = (x: FormationTest) => r.formations.find((y) => y.id === x.id);
    expect(de(f.excel)).toEqual({ id: f.excel.id, apprenants: 2, certificats: 0, a_corriger: 1 });
    expect(de(f.word)).toEqual({ id: f.word.id, apprenants: 1, certificats: 1, a_corriger: 0 });
    expect(de(f.canva)).toEqual({ id: f.canva.id, apprenants: 0, certificats: 0, a_corriger: 0 });
    expect(r.apprenants_total).toBe(2);
  });

  it("par formateur : formations, apprenants, note pondérée par les avis, corrections en attente, compte relié", async () => {
    const r = await formateurs();
    const de = (id: string) => r.formateurs.find((y) => y.id === id);
    expect(de(FA)).toEqual({ id: FA, formations_publiees: 2, formations_total: 3, apprenants: 2, note: 4.3, avis: 3, a_corriger: 1, compte_relie: true });
    expect(de(FB)).toEqual({ id: FB, formations_publiees: 1, formations_total: 1, apprenants: 0, note: null, avis: 0, a_corriger: 0, compte_relie: false });
    expect(r.totaux).toEqual({ formateurs: 2, formations_publiees: 3, a_corriger: 1, note_moyenne: 4.3 });
  });

  it("réservé à l'équipe des contenus", async () => {
    for (const qui of [MOD, E1]) {
      await expect(formations(qui)).rejects.toThrow();
      await expect(formateurs(qui)).rejects.toThrow();
    }
  });
});
