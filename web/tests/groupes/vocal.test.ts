import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Les notes vocales dans les groupes (migration 0076), côté serveur : l'envoi passe la durée et l'onde ; les lectures
// signent le lien d'écoute (une heure), comme celui des images ; une note n'est jamais analysée.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: async () => ({ id: "moi" }), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const analyserApres = vi.fn();
vi.mock("@/lib/groupes/moderation", () => ({ analyserApres: (...a: unknown[]) => analyserApres(...a) }));
vi.mock("@/lib/envois/declencher", () => ({ viderFileApres: vi.fn() }));

const { envoyerMessageGroupe } = await import("@/lib/groupes/actions");
const { avecImages } = await import("@/lib/groupes/data");
const { versMessage } = await import("@/lib/groupes/conversion");

const G = "11111111-1111-4111-8111-111111111111";
const COMPTE = "22222222-2222-4222-8222-222222222222";
const NOTE = `${COMPTE}/33333333-3333-4333-8333-333333333333.m4a`;
const RENDU = {
  id: "44444444-4444-4444-8444-444444444444",
  groupe_id: G,
  auteur: { id: COMPTE, prenom: "Awa", nom: "Kpadé" },
  de_moi: true,
  texte: "",
  image: null,
  vocal: { chemin: NOTE, type: "audio/mp4", duree_ms: 4200, ondes: [3, 60] },
  cree_le: "2026-11-04T10:00:00Z",
  analyser: false,
  version: 1,
  groupe_nom: "Général",
};

beforeEach(() => {
  faux.vider();
  analyserApres.mockReset();
});

describe("Envoyer une note vocale dans un groupe", () => {
  it("le fichier audio, sa durée et son onde partent ; le lien d'écoute revient ; pas d'analyse", async () => {
    faux.repondre("rpc.envoyer_message_groupe", { data: RENDU });
    faux.repondre("storage.groupes.createSignedUrls", { data: [{ path: NOTE, signedUrl: "https://s/n?token=t", error: null }] });
    const r = await envoyerMessageGroupe(G, "", NOTE, null, { dureeMs: 4200.4, ondes: [3, 60] });
    expect(faux.de("rpc", "envoyer_message_groupe")[0].valeurs).toEqual({ p_groupe: G, p_texte: "", p_image: NOTE, p_reponse_a: null, p_duree_ms: 4200, p_ondes: [3, 60] });
    expect(r).toMatchObject({ ok: true, message: { vocal: { chemin: NOTE, url: "https://s/n?token=t", dureeMs: 4200 }, image: null } });
    expect(analyserApres).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ image: null }), false);
  });

  it("un chemin qui n'est pas celui d'une note (ni d'une image) est refusé avant la base", async () => {
    expect(await envoyerMessageGroupe(G, "", `${COMPTE}/x.exe`, null, { dureeMs: 3000, ondes: [] })).toEqual({ ok: false, message: "Votre message n’a pas pu être envoyé. Réessayez." });
    expect(await envoyerMessageGroupe(G, "", `${COMPTE}/33333333-3333-4333-8333-333333333333.jpg`, null, { dureeMs: 3000, ondes: [] })).toEqual({
      ok: false,
      message: "Votre message n’a pas pu être envoyé. Réessayez.",
    });
    expect(faux.de("rpc", "envoyer_message_groupe")).toHaveLength(0);
  });

  it("un message ordinaire garde l'appel de la 0075 (sans durée ni onde)", async () => {
    faux.repondre("rpc.envoyer_message_groupe", { data: { ...RENDU, vocal: null, texte: "Salut" } });
    await envoyerMessageGroupe(G, "Salut", null, null);
    expect(faux.de("rpc", "envoyer_message_groupe")[0].valeurs).toEqual({ p_groupe: G, p_texte: "Salut", p_image: null, p_reponse_a: null });
  });
});

describe("Les liens des fichiers d'un fil", () => {
  it("images et notes vocales signées en un seul appel ; un lien manquant reste null", async () => {
    faux.repondre("storage.groupes.createSignedUrls", { data: [{ path: NOTE, signedUrl: "https://s/n", error: null }] });
    const messages = [
      versMessage(RENDU),
      versMessage({ ...RENDU, id: "m2", vocal: null, image: { chemin: `${COMPTE}/i.jpg`, type: "image/jpeg" } }),
    ];
    const signes = await avecImages(faux.client as never, messages);
    expect(faux.de("storage.groupes", "createSignedUrls")[0].valeurs).toEqual([[NOTE, `${COMPTE}/i.jpg`], 3600]);
    expect(signes[0].vocal?.url).toBe("https://s/n");
    expect(signes[1].image?.url).toBeNull();
  });
});
