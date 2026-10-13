import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "./faux-supabase";

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { saveLecon } = await import("@/lib/admin/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const L = "33333333-3333-4333-8333-333333333333";
const form = (valeurs: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(valeurs)) fd.set(k, v);
  return fd;
};
const SAISIE = {
  id: L,
  titre: "Les tableaux croisés dynamiques",
  titre_court: "Tableaux croisés dynamiques",
  duree: "12:40",
  apercu: "on",
  video: "https://youtu.be/dQw4w9WgXcQ?si=x",
  resume: "Résumé",
  points_cles: "Créer\n\n Modifier \n",
  texte: "Texte",
};

describe("Back-office : une leçon", () => {
  beforeEach(() => {
    faux.vider();
    refresh.mockReset();
    getShellUser.mockReset();
    getShellUser.mockResolvedValue({ roles: ["admin"] });
  });

  it("un lien YouTube est enregistré par son identifiant, avec la durée en secondes", async () => {
    const state = await saveLecon(IDLE, form(SAISIE));
    expect(state.status).toBe("success");
    const [maj] = faux.de("lecons", "update");
    expect(maj.valeurs).toEqual({
      titre: "Les tableaux croisés dynamiques",
      titre_court: "Tableaux croisés dynamiques",
      duree_secondes: 760,
      apercu: true,
      resume: "Résumé",
      points_cles: ["Créer", "Modifier"],
    });
    expect(maj.filtres).toContainEqual(["eq", "id", L]);
    expect(faux.de("lecons_contenus", "upsert")[0].valeurs).toEqual({ lecon_id: L, video_fournisseur: "youtube", video_id: "dQw4w9WgXcQ", texte: "Texte" });
    expect(refresh).toHaveBeenCalled();
  });

  it("un lien inconnu est refusé sur son champ", async () => {
    const state = await saveLecon(IDLE, form({ ...SAISIE, video: "https://exemple.com/video.mp4" }));
    expect(state.fieldErrors?.video).toBe("Ce lien n’est ni une vidéo YouTube ni une vidéo Vimeo.");
    expect(state.values?.video).toBe("https://exemple.com/video.mp4");
    expect(faux.appels).toEqual([]);
  });

  it("effacer le lien retire la vidéo ; un titre court vide devient nul", async () => {
    await saveLecon(IDLE, form({ ...SAISIE, video: "  ", titre_court: "" }));
    expect(faux.de("lecons_contenus", "upsert")[0].valeurs).toMatchObject({ video_fournisseur: null, video_id: null });
    expect(faux.de("lecons", "update")[0].valeurs).toMatchObject({ titre_court: null });
  });

  it("la durée se saisit en minutes et secondes", async () => {
    const state = await saveLecon(IDLE, form({ ...SAISIE, duree: "12:75" }));
    expect(state.fieldErrors?.duree).toBe("Durée au format 12:40.");
    expect(faux.appels).toEqual([]);
  });

  it("une leçon avec vidéo doit avoir sa durée : elle sert à mesurer le temps regardé", async () => {
    const state = await saveLecon(IDLE, form({ ...SAISIE, duree: "" }));
    expect(state.fieldErrors?.duree).toBe("Saisissez la durée de la vidéo : elle sert à mesurer le temps regardé.");
    // Sans vidéo, la durée reste facultative.
    expect((await saveLecon(IDLE, form({ ...SAISIE, video: "", duree: "" }))).fieldErrors?.duree).toBeUndefined();
  });

  it("un lien Vimeo non répertorié garde son code", async () => {
    await saveLecon(IDLE, form({ ...SAISIE, video: "https://vimeo.com/76979871/abcdef0123" }));
    expect(faux.de("lecons_contenus", "upsert")[0].valeurs).toMatchObject({ video_fournisseur: "vimeo", video_id: "76979871/abcdef0123" });
  });

  it("un étudiant ne modifie pas une leçon", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant"] });
    expect((await saveLecon(IDLE, form(SAISIE))).message).toBe("Accès réservé aux formateurs et à l’équipe.");
    expect(faux.appels).toEqual([]);
  });
});
