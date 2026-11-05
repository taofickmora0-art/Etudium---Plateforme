import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// L'accès serveur de « Mes résultats » (migration 0077) : le jeton de déverrouillage voyage du cookie httpOnly à
// l'en-tête x-etudium-resultats ; les actions vérifient la saisie avant la base, prolongent l'ouverture (etat_resultats)
// et rendent les messages de la base ; la lecture remet un parcours et tout ce qu'il contient dans l'ordre.

const faux = fauxSupabase();
const options: unknown[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async (o?: unknown) => {
    options.push(o);
    return faux.client;
  },
}));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false, getShellUser: async () => ({ id: "moi" }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const biscuits = new Map<string, { value: string; options?: unknown }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (nom: string) => biscuits.get(nom),
    set: (nom: string, value: string, o?: unknown) => biscuits.set(nom, { value, options: o }),
    delete: (nom: string) => biscuits.delete(nom),
  }),
}));

const actions = await import("@/lib/resultats/actions");
const { lireParcoursComplet, lireEtatResultats } = await import("@/lib/resultats/data");
const { COOKIE_RESULTATS } = await import("@/lib/resultats/acces");

const P = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const U = "33333333-3333-4333-8333-333333333333";
const E = "44444444-4444-4444-8444-444444444444";
const OUVERT = { data: { pin: true, ouvert: true, bloque_jusqua: null, propose: true } };

beforeEach(() => {
  faux.vider();
  options.length = 0;
  biscuits.clear();
});

describe("Le jeton de déverrouillage", () => {
  it("passe du cookie à l'en-tête de la base", async () => {
    biscuits.set(COOKIE_RESULTATS, { value: "abc123" });
    faux.repondre("rpc.etat_resultats", OUVERT);
    expect(await lireEtatResultats()).toEqual({ pin: true, ouvert: true, bloqueJusqua: null, propose: true });
    expect(options.at(-1)).toEqual({ entetes: { "x-etudium-resultats": "abc123" } });
  });

  it("ouvrir avec le bon code pose le cookie (httpOnly) ; un refus rend le message de la base", async () => {
    faux.repondre("rpc.ouvrir_resultats", { data: { ok: true, jeton: "j".repeat(64) } });
    expect(await actions.ouvrirResultats("2580")).toEqual({ ok: true });
    expect(faux.de("rpc", "ouvrir_resultats")[0].valeurs).toEqual({ p_pin: "2580" });
    expect(biscuits.get(COOKIE_RESULTATS)).toMatchObject({ value: "j".repeat(64), options: { httpOnly: true, sameSite: "lax", path: "/" } });
    faux.repondre("rpc.ouvrir_resultats", { data: { ok: false, message: "Code incorrect. Encore 4 essais." } });
    expect(await actions.ouvrirResultats("0000")).toEqual({ ok: false, message: "Code incorrect. Encore 4 essais." });
    expect(await actions.ouvrirResultats("12a4")).toEqual({ ok: false, message: "Le code doit faire 4 chiffres." });
  });

  it("verrouiller retire le jeton de la base et le cookie", async () => {
    biscuits.set(COOKIE_RESULTATS, { value: "abc" });
    await actions.verrouillerResultats();
    expect(faux.de("rpc", "fermer_resultats")).toHaveLength(1);
    expect(biscuits.has(COOKIE_RESULTATS)).toBe(false);
  });

  it("code oublié sans connexion récente : il faut se reconnecter", async () => {
    faux.repondre("rpc.oublier_pin_resultats", { error: { code: "42501", message: "Reconnecte-toi pour créer un nouveau code." } });
    expect(await actions.oublierPin()).toEqual({ ok: false, message: "Reconnecte-toi pour créer un nouveau code.", reconnecter: true });
  });
});

describe("La saisie", () => {
  it("une UE : vérifiée avant la base, puis enregistrée après avoir prolongé l'ouverture", async () => {
    expect(await actions.enregistrerUe({ semestreId: S, code: "AGR101", intitule: "Biologie", credits: 0 })).toEqual({ ok: false, message: "Les crédits vont de 0,5 à 60." });
    expect(faux.appels).toHaveLength(0);
    faux.repondre("rpc.etat_resultats", OUVERT);
    faux.repondre("ue_scolaires.insert", { data: { id: U } });
    expect(await actions.enregistrerUe({ semestreId: S, code: " AGR101 ", intitule: " Biologie végétale ", credits: 5 })).toEqual({ ok: true, id: U });
    expect(faux.appels.map((a) => `${a.table}.${a.op}`)).toEqual(["rpc.etat_resultats", "ue_scolaires.insert"]);
    expect(faux.de("ue_scolaires", "insert")[0].valeurs).toEqual({ semestre_id: S, code: "AGR101", intitule: "Biologie végétale", credits: 5 });
  });

  it("espace reverrouillé : rien ne part, le message le dit", async () => {
    faux.repondre("rpc.etat_resultats", { data: { pin: true, ouvert: false, bloque_jusqua: null, propose: true } });
    expect(await actions.enregistrerNote({ ecueId: E, categorie: "cc", libelle: "Interrogation 1", note: 14, sur: 20, rattrapage: false, date: null })).toEqual({
      ok: false,
      message: "Ton espace s’est reverrouillé : saisis ton code.",
      verrouille: true,
    });
    expect(faux.de("notes_scolaires")).toHaveLength(0);
  });

  it("une note sur 10 au-dessus de 10 est refusée ; une modification passe par update", async () => {
    expect(await actions.enregistrerNote({ ecueId: E, categorie: "cc", libelle: "", note: 12, sur: 10, rattrapage: false, date: null })).toEqual({ ok: false, message: "La note doit être entre 0 et 10." });
    faux.repondre("rpc.etat_resultats", OUVERT);
    faux.repondre("notes_scolaires.update", { data: { id: "n1" } });
    expect(await actions.enregistrerNote({ id: "55555555-5555-4555-8555-555555555555", ecueId: E, categorie: "examen", libelle: "Examen", note: 9.5, sur: 20, rattrapage: true, date: "2026-02-10" })).toMatchObject({ ok: true });
    expect(faux.de("notes_scolaires", "update")[0].valeurs).toEqual({ categorie: "examen", libelle: "Examen", note: 9.5, sur: 20, rattrapage: true, date: "2026-02-10" });
  });

  it("les règles d'un parcours partent au format de la base", async () => {
    faux.repondre("rpc.etat_resultats", OUVERT);
    faux.repondre("parcours_scolaires.insert", { data: { id: P } });
    await actions.enregistrerParcours({
      nom: "Licence en agronomie",
      etablissement: "UAC",
      regles: { seuilUe: 12, seuilSemestre: 10, compensation: true, rattrapage: "meilleure", categories: [{ cle: "examen", nom: "Examen", poids: 100, examen: true }] },
    });
    expect(faux.de("parcours_scolaires", "insert")[0].valeurs).toEqual({
      nom: "Licence en agronomie",
      etablissement: "UAC",
      regles: { seuil_ue: 12, seuil_semestre: 10, compensation: true, rattrapage: "meilleure", categories: [{ cle: "examen", nom: "Examen", poids: 100, examen: true }] },
    });
  });
});

describe("La lecture", () => {
  it("un parcours et tout ce qu'il contient, à plat et dans l'ordre", async () => {
    faux.repondre("parcours_scolaires.select", {
      data: {
        id: P,
        nom: "Licence",
        etablissement: "UAC",
        ordre: 0,
        regles: { seuil_ue: 10, seuil_semestre: 10, compensation: false, rattrapage: "remplace", categories: [{ cle: "cc", nom: "CC", poids: 40 }, { cle: "examen", nom: "Examen", poids: 60, examen: true }] },
        semestres_scolaires: [
          { id: "s2", parcours_id: P, nom: "Semestre 2", annee: "", ordre: 1, ue_scolaires: [] },
          {
            id: S,
            parcours_id: P,
            nom: "Semestre 1",
            annee: "2025-2026",
            ordre: 0,
            ue_scolaires: [
              {
                id: U,
                semestre_id: S,
                code: "AGR101",
                intitule: "Biologie",
                credits: "5.0",
                ordre: 0,
                ecue_scolaires: [{ id: E, ue_id: U, intitule: "Botanique", poids: "3.00", bareme: null, ordre: 0, notes_scolaires: [{ id: "n1", ecue_id: E, categorie: "cc", libelle: "I1", note: "14.00", sur: "20.00", rattrapage: false, date: null, cree_le: "2026-01-01T00:00:00Z" }] }],
              },
            ],
          },
        ],
      },
    });
    const p = await lireParcoursComplet(P);
    expect(p?.parcours).toMatchObject({ nom: "Licence", regles: { seuilUe: 10, rattrapage: "remplace" } });
    expect(p?.semestres.map((s) => s.nom)).toEqual(["Semestre 1", "Semestre 2"]);
    expect(p?.ues[0]).toMatchObject({ credits: 5, code: "AGR101" });
    expect(p?.ecues[0]).toMatchObject({ poids: 3, bareme: null });
    expect(p?.notes[0]).toMatchObject({ note: 14, sur: 20, categorie: "cc" });
    expect(await lireParcoursComplet("pas-un-uuid")).toBeNull();
  });
});
