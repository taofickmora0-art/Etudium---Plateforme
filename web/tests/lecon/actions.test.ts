import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { id } from "./donnees";

const faux = fauxSupabase();
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));
let compte: { id: string } | null = { id: "compte-1" };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ ...faux.client, auth: { getUser: async () => ({ data: { user: compte }, error: null }) } }),
}));

const { enregistrerNote, lienRessource } = await import("@/lib/lecon/actions");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const RESSOURCE = { id: id(301), titre: "Données de l’enquête", fichier: `${id(1)}/abc.xlsx`, format: XLSX, telechargeable: true };

describe("Notes privées", () => {
  beforeEach(() => {
    faux.vider();
    compte = { id: "compte-1" };
    refresh.mockReset();
  });

  it("sans compte, rien n'est enregistré", async () => {
    compte = null;
    expect(await enregistrerNote(id(1), "Ctrl + T")).toEqual({ ok: false, erreur: "Connectez-vous pour enregistrer vos notes." });
    expect(faux.de("notes_lecons")).toEqual([]);
  });

  it("une note trop longue est refusée", async () => {
    expect(await enregistrerNote(id(1), "a".repeat(5001))).toEqual({ ok: false, erreur: "Votre note dépasse 5 000 caractères." });
    expect(faux.de("notes_lecons")).toEqual([]);
  });

  it("une note est enregistrée pour ce compte et cette leçon, ou remplacée", async () => {
    expect(await enregistrerNote(id(1), "Ctrl + T")).toEqual({ ok: true });
    const [appel] = faux.de("notes_lecons", "upsert");
    expect(appel.valeurs).toEqual({ profil_id: "compte-1", lecon_id: id(1), texte: "Ctrl + T" });
    expect(appel.options).toEqual({ onConflict: "profil_id,lecon_id" });
    // La page est relue : un retour arrière ou un autre onglet ne montrent pas l'ancienne note.
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("une note vidée est effacée", async () => {
    expect(await enregistrerNote(id(1), "   ")).toEqual({ ok: true });
    const [appel] = faux.de("notes_lecons", "delete");
    expect(appel.filtres).toEqual(expect.arrayContaining([["eq", "lecon_id", id(1)], ["eq", "profil_id", "compte-1"]]));
  });

  it("une erreur de la base, ou une leçon mal désignée, laisse un message", async () => {
    faux.repondre("notes_lecons.upsert", { error: { code: "42501", message: "refusé" } });
    expect(await enregistrerNote(id(3), "x")).toEqual({ ok: false, erreur: "La note n’a pas pu être enregistrée. Réessayez." });
    expect(refresh).not.toHaveBeenCalled();
    expect(await enregistrerNote("abc", "x")).toEqual({ ok: false, erreur: "La note n’a pas pu être enregistrée. Réessayez." });
  });
});

describe("Lien de téléchargement d'une ressource", () => {
  beforeEach(() => {
    faux.vider();
  });

  it("une ressource introuvable (ou sans accès) est refusée", async () => {
    expect(await lienRessource(id(301))).toEqual({ erreur: "Ce fichier n’est pas accessible." });
    expect(await lienRessource("abc")).toEqual({ erreur: "Ce fichier n’est pas accessible." });
  });

  it("une ressource en consultation seule ne se télécharge pas", async () => {
    faux.repondre("ressources.select", { data: { ...RESSOURCE, format: "application/pdf", telechargeable: false } });
    expect(await lienRessource(id(301))).toEqual({ erreur: "Ce fichier se consulte sans téléchargement." });
    expect(faux.de("storage.ressources")).toEqual([]);
  });

  it("le lien dure 60 secondes et porte le nom du fichier, accents compris (encodé une seule fois)", async () => {
    faux.repondre("ressources.select", { data: RESSOURCE });
    faux.repondre("storage.ressources.createSignedUrl", { data: { signedUrl: "https://stockage/lien-signe?token=abc" } });
    expect(await lienRessource(id(301))).toEqual({ url: `https://stockage/lien-signe?token=abc&download=${encodeURIComponent("Données de l’enquête.xlsx")}` });
    expect(faux.de("storage.ressources", "createSignedUrl")[0].valeurs).toEqual([RESSOURCE.fichier, 60]);
  });

  it("un titre qui porte déjà l'extension ne la double pas ; une barre oblique ne casse pas le nom", async () => {
    faux.repondre("ressources.select", { data: { ...RESSOURCE, titre: "notes 2025/2026.XLSX" } });
    faux.repondre("storage.ressources.createSignedUrl", { data: { signedUrl: "https://stockage/x?token=abc" } });
    expect(await lienRessource(id(301))).toEqual({ url: `https://stockage/x?token=abc&download=${encodeURIComponent("notes 2025-2026.XLSX")}` });
  });

  it("si le lien ne peut pas être créé, un message le dit", async () => {
    faux.repondre("ressources.select", { data: RESSOURCE });
    faux.repondre("storage.ressources.createSignedUrl", { error: { message: "panne" } });
    expect(await lienRessource(id(301))).toEqual({ erreur: "Le lien n’a pas pu être créé. Réessayez." });
  });
});
