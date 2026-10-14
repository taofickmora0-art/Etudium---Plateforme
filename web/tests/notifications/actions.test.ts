import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCES_EQUIPE, SESSION_EXPIREE } from "@/lib/admin/garde";
import { fauxSupabase } from "../admin/faux-supabase";

// Actions des notifications : la cloche, la page, marquer lu, et les annonces de l'équipe (migration 0016).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { chargerCloche, chargerNotifications, marquerLues, publierAnnonce } = await import("@/lib/notifications/actions");

const LOT = { lignes: [{ id: 7, categorie: "service", titre: "Vous êtes formateur", texte: "", lien: "/formateur", cree_le: "2026-10-14T10:00:00+00:00", lue: false }], suite: false, non_lues: 1 };
const LIEN_REFUSE = "Le lien doit être une adresse du site, commençant par « / ».";

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ roles: ["etudiant"] });
});

describe("La cloche et la page", () => {
  it("chargerCloche : les 8 dernières ; null sans session, avant la 0016 ou en cas d'erreur", async () => {
    faux.repondre("rpc.mes_notifications", { data: LOT });
    expect(await chargerCloche()).toEqual({
      lignes: [{ id: "7", categorie: "service", titre: "Vous êtes formateur", texte: "", lien: "/formateur", creeLe: "2026-10-14T10:00:00+00:00", lue: false }],
      suite: false,
      nonLues: 1,
    });
    expect(faux.de("rpc", "mes_notifications")[0].valeurs).toEqual({ p_non_lues: false, p_avant: null, p_nombre: 8 });

    faux.repondre("rpc.mes_notifications", { error: { code: "PGRST202" } });
    expect(await chargerCloche()).toBeNull();
    const consigne = vi.spyOn(console, "error").mockImplementation(() => {});
    faux.repondre("rpc.mes_notifications", { error: { code: "500", message: "panne" } });
    expect(await chargerCloche()).toBeNull();
    expect(consigne).toHaveBeenCalled();
    consigne.mockRestore();

    faux.vider();
    getShellUser.mockResolvedValue(null);
    expect(await chargerCloche()).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("chargerNotifications : 20 à la fois, depuis un curseur ; refus sans session ; erreur affichée", async () => {
    faux.repondre("rpc.mes_notifications", { data: LOT });
    expect(await chargerNotifications(true, "8")).toMatchObject({ ok: true, page: { nonLues: 1 } });
    expect(faux.de("rpc", "mes_notifications")[0].valeurs).toEqual({ p_non_lues: true, p_avant: 8, p_nombre: 20 });
    faux.repondre("rpc.mes_notifications", { error: { code: "500", message: "panne" } });
    expect(await chargerNotifications(false, null)).toEqual({ ok: false, message: "Les notifications n’ont pas pu être chargées. Réessayez." });
    getShellUser.mockResolvedValue(null);
    expect(await chargerNotifications(false, null)).toEqual({ ok: false, message: SESSION_EXPIREE });
  });

  it("marquerLues : les identifiants valables ; null = toutes ; une liste vide n'appelle rien", async () => {
    expect(await marquerLues(["12", "abc"])).toEqual({ ok: true });
    expect(await marquerLues(null)).toEqual({ ok: true });
    expect(faux.de("rpc", "marquer_lues").map((a) => a.valeurs)).toEqual([{ p_ids: [12] }, { p_ids: null }]);
    faux.vider();
    expect(await marquerLues([])).toEqual({ ok: true });
    expect(await marquerLues(["abc"])).toEqual({ ok: true });
    expect(faux.appels).toEqual([]);
    faux.repondre("rpc.marquer_lues", { error: { code: "500" } });
    expect(await marquerLues(null)).toEqual({ ok: false, message: "Les notifications n’ont pas pu être marquées comme lues. Réessayez." });
    getShellUser.mockResolvedValue(null);
    expect(await marquerLues(null)).toEqual({ ok: false, message: SESSION_EXPIREE });
  });
});

describe("Les annonces", () => {
  it("refusée à un étudiant, sans appel ; lien hors du site, titre ou texte vides : refusés sans appel", async () => {
    expect(await publierAnnonce("Titre", "Texte", "")).toEqual({ ok: false, message: ACCES_EQUIPE });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    expect(await publierAnnonce("Titre", "Texte", "https://ailleurs.com")).toEqual({ ok: false, message: LIEN_REFUSE });
    expect(await publierAnnonce("  ", "Texte", "")).toEqual({ ok: false, message: "Écrivez un titre (80 caractères au plus)." });
    expect(await publierAnnonce("t".repeat(81), "Texte", "")).toEqual({ ok: false, message: "Écrivez un titre (80 caractères au plus)." });
    expect(await publierAnnonce("Titre", "x".repeat(301), "")).toEqual({ ok: false, message: "Écrivez le texte de l’annonce (300 caractères au plus)." });
    expect(faux.appels).toEqual([]);
  });

  it("envoyée : la fonction de la base, le nombre de destinataires, la page relue ; son refus est affiché", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    faux.repondre("rpc.publier_annonce", { data: 12 });
    expect(await publierAnnonce(" Nouveautés ", "La page est en ligne.", "  ")).toEqual({ ok: true, destinataires: 12 });
    expect(faux.de("rpc", "publier_annonce")[0].valeurs).toEqual({ p_titre: "Nouveautés", p_texte: "La page est en ligne.", p_lien: null });
    expect(refresh).toHaveBeenCalled();
    faux.repondre("rpc.publier_annonce", { error: { code: "P0001", message: LIEN_REFUSE } });
    expect(await publierAnnonce("Titre", "Texte", "/a")).toEqual({ ok: false, message: LIEN_REFUSE });
    faux.repondre("rpc.publier_annonce", { error: { code: "500", message: "panne" } });
    expect(await publierAnnonce("Titre", "Texte", "/a")).toEqual({ ok: false, message: "L’annonce n’a pas pu être envoyée. Réessayez." });
  });
});
