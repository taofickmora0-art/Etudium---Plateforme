import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// L'onglet « Apprenants » d'une formation (migration 0029) : la lecture de la première page et l'action des filtres.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));

const { lireApprenants, MIGRATION_APPRENANTS } = await import("@/lib/formateur/apprenants");
const { chercherApprenants } = await import("@/lib/formateur/actions-apprenants");

const E = "11111111-1111-4111-8111-111111111111";
const X = "22222222-2222-4222-8222-222222222222";
const BRUT = {
  resume: { apprenants: 2, progression_moyenne: 50, terminees: 1, a_risque: 1 },
  total: 2,
  lignes: [
    { etudiant_id: E, prenom: "Fifamè", nom: "Adjovi", terminees: 3, total: 12, premiere_ouverture: "2026-10-01T08:00:00+00:00", derniere_activite: "2026-10-13T08:00:00+00:00", etat: "a_risque" },
  ],
};
const CONVERTI = {
  resume: { apprenants: 2, progressionMoyenne: 50, terminees: 1, aRisque: 1 },
  total: 2,
  lignes: [{ etudiantId: E, prenom: "Fifamè", nom: "Adjovi", terminees: 3, total: 12, premiereOuverture: "2026-10-01T08:00:00+00:00", derniereActivite: "2026-10-13T08:00:00+00:00", etat: "a_risque" }],
};

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
});

describe("Lecture des apprenants", () => {
  it("la première page, convertie", async () => {
    faux.repondre("rpc.apprenants_formation", { data: BRUT });
    expect(await lireApprenants(X)).toEqual({ migrationAbsente: false, donnees: CONVERTI });
    expect(faux.de("rpc", "apprenants_formation")[0].valeurs).toEqual({ p_formation: X, p_recherche: "", p_etat: "tous", p_page: 1 });
  });

  it("avant la 0029 : la migration manque ; un état inconnu devient « En cours »", async () => {
    faux.repondre("rpc.apprenants_formation", { error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await lireApprenants(X)).toEqual({ migrationAbsente: true });
    faux.vider();
    faux.repondre("rpc.apprenants_formation", { data: { ...BRUT, lignes: [{ ...BRUT.lignes[0], etat: "bizarre" }] } });
    const lu = await lireApprenants(X);
    expect(!lu.migrationAbsente && lu.donnees.lignes[0].etat).toBe("en_cours");
    expect(MIGRATION_APPRENANTS).toBe("Appliquez la migration 0029 (guide « Ce qui te revient », section 35).");
  });
});

describe("Filtres et pages des apprenants", () => {
  it("l'équipe et le formateur cherchent ; paramètres nettoyés", async () => {
    faux.repondre("rpc.apprenants_formation", { data: BRUT });
    expect(await chercherApprenants(X, `  ${"a".repeat(300)}  `, "nimporte" as never, -3)).toEqual({ ok: true, page: CONVERTI });
    expect(faux.de("rpc", "apprenants_formation")[0].valeurs).toEqual({ p_formation: X, p_recherche: "a".repeat(200), p_etat: "tous", p_page: 1 });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    await chercherApprenants(X, "fifa", "a_risque", 2);
    expect(faux.de("rpc", "apprenants_formation")[1].valeurs).toEqual({ p_formation: X, p_recherche: "fifa", p_etat: "a_risque", p_page: 2 });
  });

  it("refus : sans compte, un étudiant, un identifiant mal formé (sans appel) ; le message de la base ; la migration absente", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await chercherApprenants(X, "", "tous", 1)).toMatchObject({ ok: false });
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect(await chercherApprenants(X, "", "tous", 1)).toEqual({ ok: false, message: "Accès réservé aux formateurs et à l’équipe." });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    expect(await chercherApprenants("pas-un-id", "", "tous", 1)).toEqual({ ok: false, message: "La liste n’a pas pu être chargée. Réessayez." });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.apprenants_formation", { error: { code: "42501", message: "Cette formation n'est pas l'une de vos formations." } });
    expect(await chercherApprenants(X, "", "tous", 1)).toEqual({ ok: false, message: "Cette formation n’est pas l’une de vos formations." });
    faux.vider();
    faux.repondre("rpc.apprenants_formation", { error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await chercherApprenants(X, "", "tous", 1)).toEqual({ ok: false, message: "Appliquez la migration 0029 (guide « Ce qui te revient », section 35)." });
  });
});
