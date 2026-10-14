import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DonneesSession } from "@/lib/sessions/types";
import { fauxSupabase } from "../admin/faux-supabase";

// Le visuel de promotion d'une session (spec promotion des sessions live, §1 et §4) et le compteur des nouvelles sessions.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { creerSession, modifierSession } = await import("@/lib/sessions/actions");
const { compterNouvellesSessions, marquerEvenementsVus } = await import("@/lib/sessions/nouvelles");

const ID = "11111111-1111-4111-8111-111111111111";
const MOI = "22222222-2222-4222-8222-222222222222";
const dans30 = new Date(Date.now() + 30 * 86_400_000);
const D: DonneesSession = {
  titre: "Excel avancé",
  description: "",
  date: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(dans30),
  heure: "15:00",
  dureeMinutes: 60,
  lien: "https://meet.google.com/abc-defg-hij",
  parcoursId: null,
  formateurId: null,
};
const AFFICHE = { chemin: `${MOI}/a.png`, nom: "affiche.png", type: "image/png", taille: 2048 };
const MIGRATION_PROMOTION = "Appliquez la migration 0024 (guide « Ce qui te revient », section 29).";

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
});

describe("Le visuel de promotion", () => {
  it("l'affiche et la vidéo sont transmises ; sans visuel, rien (la session marche aussi avant la 0024)", async () => {
    faux.repondre("rpc.creer_session", { data: ID });
    await creerSession({ ...D, image: AFFICHE });
    expect(faux.de("rpc", "creer_session")[0].valeurs).toMatchObject({ p_image: AFFICHE });
    await creerSession({ ...D, video: "https://youtu.be/dQw4w9WgXcQ" });
    expect(faux.de("rpc", "creer_session")[1].valeurs).toMatchObject({ p_video: { plateforme: "youtube", id: "dQw4w9WgXcQ" } });
    await creerSession(D);
    expect(faux.de("rpc", "creer_session")[2].valeurs).not.toHaveProperty("p_image");
    expect(faux.de("rpc", "creer_session")[2].valeurs).not.toHaveProperty("p_video");
  });

  it("une vidéo non reconnue, ou une affiche et une vidéo : refusées sans appel", async () => {
    expect(await creerSession({ ...D, video: "bonjour" })).toEqual({ ok: false, message: "Collez l’adresse complète de la vidéo (https://…)." });
    expect(await creerSession({ ...D, image: AFFICHE, video: "https://youtu.be/dQw4w9WgXcQ" })).toEqual({
      ok: false,
      message: "Choisissez une affiche ou une vidéo, pas les deux.",
    });
    expect(faux.appels).toEqual([]);
  });

  it("le lien d'un live ne sert pas de vidéo (refusé sans appel) ; une affiche refusée par la base quitte le stockage", async () => {
    expect(await creerSession({ ...D, video: "https://meet.google.com/abc-defg-hij" })).toEqual({ ok: false, message: "Le lien du live ne peut pas servir de vidéo de promotion." });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.creer_session", { error: { code: "P0001", message: "Choisissez une date au moins 10 minutes dans le futur." } });
    expect(await creerSession({ ...D, image: AFFICHE })).toMatchObject({ ok: false });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[AFFICHE.chemin]]);
  });

  it("avant la 0024, avec un visuel : le message de la migration", async () => {
    faux.repondre("rpc.creer_session", { error: { code: "PGRST202" } });
    expect(await creerSession({ ...D, image: AFFICHE })).toEqual({ ok: false, message: MIGRATION_PROMOTION });
  });

  it("modifier en remplaçant l'affiche : l'ancienne est retirée du stockage ; la même : rien n'est retiré", async () => {
    faux.repondre("rpc.session_detail", { data: { id: ID, promo_image: { chemin: `${MOI}/ancienne.png`, nom: "a", type: "image/png", taille: 1 } } });
    expect(await modifierSession(ID, { ...D, image: AFFICHE })).toEqual({ ok: true });
    expect(faux.de("storage.communaute", "remove")[0].valeurs).toEqual([[`${MOI}/ancienne.png`]]);
    faux.vider();
    faux.repondre("rpc.session_detail", { data: { id: ID, promo_image: AFFICHE } });
    await modifierSession(ID, { ...D, image: AFFICHE });
    expect(faux.de("storage.communaute", "remove")).toEqual([]);
  });

  it("modifier en échec : l'ancienne affiche reste ; la nouvelle, refusée, quitte le stockage (revue)", async () => {
    faux.repondre("rpc.session_detail", { data: { id: ID, promo_image: { chemin: `${MOI}/ancienne.png`, nom: "a", type: "image/png", taille: 1 } } });
    faux.repondre("rpc.modifier_session", { error: { code: "P0001", message: "Cette session est annulée." } });
    expect(await modifierSession(ID, { ...D, image: AFFICHE })).toEqual({ ok: false, message: "Cette session est annulée." });
    expect(faux.de("storage.communaute", "remove").map((a) => a.valeurs)).toEqual([[[AFFICHE.chemin]]]);
  });
});

describe("Nouvelles sessions", () => {
  it("le nombre de la base ; 0 sans session, avant la 0024 ou en erreur", async () => {
    faux.repondre("rpc.nouvelles_sessions", { data: 3 });
    expect(await compterNouvellesSessions()).toBe(3);
    faux.repondre("rpc.nouvelles_sessions", { error: { code: "PGRST202" } });
    expect(await compterNouvellesSessions()).toBe(0);
    getShellUser.mockResolvedValue(null);
    expect(await compterNouvellesSessions()).toBe(0);
  });

  it("marquerEvenementsVus appelle la base (sans erreur visible)", async () => {
    await marquerEvenementsVus();
    expect(faux.de("rpc", "marquer_evenements_vus")).toHaveLength(1);
    faux.repondre("rpc.marquer_evenements_vus", { error: { code: "PGRST202" } });
    await expect(marquerEvenementsVus()).resolves.toBeUndefined();
  });
});
