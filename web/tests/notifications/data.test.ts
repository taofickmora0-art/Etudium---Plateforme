import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures des notifications et des annonces (migration 0016).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
let demo = false;
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => demo }));

const { lireAnnonces, lireNotifications, versLot } = await import("@/lib/notifications/data");
const { TON_CATEGORIE } = await import("@/components/notifications/affichage");

const BRUT = {
  lignes: [
    { id: 41, categorie: "annonces", titre: "Nouveautés", texte: "La page est en ligne.", lien: "/notifications", cree_le: "2026-10-14T10:00:00+00:00", lue: false },
    { id: 40, categorie: "inconnue", titre: "Ancienne", texte: "", lien: "https://ailleurs.com", cree_le: "2026-10-13T10:00:00+00:00", lue: true },
  ],
  suite: true,
  non_lues: 3,
};

beforeEach(() => {
  faux.vider();
  demo = false;
});

describe("Lecture des notifications", () => {
  it("un lot, converti : identifiant en chaîne, catégorie connue, lien du site seulement", async () => {
    faux.repondre("rpc.mes_notifications", { data: BRUT });
    expect(await lireNotifications({ nonLues: true, avant: "42", nombre: 8 })).toEqual({
      migrationAbsente: false,
      donnees: {
        lignes: [
          { id: "41", categorie: "annonces", titre: "Nouveautés", texte: "La page est en ligne.", lien: "/notifications", creeLe: "2026-10-14T10:00:00+00:00", lue: false },
          { id: "40", categorie: "service", titre: "Ancienne", texte: "", lien: null, creeLe: "2026-10-13T10:00:00+00:00", lue: true },
        ],
        suite: true,
        nonLues: 3,
      },
    });
    expect(faux.de("rpc", "mes_notifications")[0].valeurs).toEqual({ p_non_lues: true, p_avant: 42, p_nombre: 8 });
  });

  it("une notification de message (lot 5) garde sa catégorie et s'affiche avec la bulle de discussion", () => {
    const lot = versLot({
      lignes: [{ id: 7, categorie: "messages", titre: "Nouveau message d’Aïcha Kpadé", texte: "Bonjour", lien: "/formateur/messages?c=c1", cree_le: "2026-10-16T09:00:00+00:00", lue: false }],
      suite: false,
      non_lues: 1,
    });
    expect(lot.lignes[0]).toMatchObject({ categorie: "messages", lien: "/formateur/messages?c=c1" });
    expect(TON_CATEGORIE.messages).toEqual({ tone: "information", icon: BubbleChatIcon });
  });

  it("par défaut : toutes, depuis le début, 20 ; un curseur qui n'est pas un nombre est ignoré", async () => {
    faux.repondre("rpc.mes_notifications", { data: { lignes: [], suite: false, non_lues: 0 } });
    await lireNotifications({});
    await lireNotifications({ avant: "abc" });
    expect(faux.de("rpc", "mes_notifications").map((a) => a.valeurs)).toEqual([
      { p_non_lues: false, p_avant: null, p_nombre: 20 },
      { p_non_lues: false, p_avant: null, p_nombre: 20 },
    ]);
  });

  it("avant la 0016 : migrationAbsente ; toute autre erreur est relancée", async () => {
    faux.repondre("rpc.mes_notifications", { error: { code: "PGRST202" } });
    expect(await lireNotifications({})).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.mes_notifications", { error: { code: "500", message: "panne" } });
    await expect(lireNotifications({})).rejects.toThrow();
  });

  it("en mode démo : un lot vide, sans appel", async () => {
    demo = true;
    expect(await lireNotifications({})).toEqual({ migrationAbsente: false, donnees: { lignes: [], suite: false, nonLues: 0 } });
    expect(await lireAnnonces()).toEqual({ migrationAbsente: false, donnees: [] });
    expect(faux.appels).toEqual([]);
  });
});

describe("Lecture des annonces", () => {
  it("la liste, convertie ; avant la 0016 : migrationAbsente", async () => {
    faux.repondre("rpc.annonces_equipe", {
      data: [{ id: "a1", titre: "Nouveautés", texte: "Texte", lien: null, auteur: "Aïcha Kpadé", cree_le: "2026-10-14T10:00:00+00:00", destinataires: 12 }],
    });
    expect(await lireAnnonces()).toEqual({
      migrationAbsente: false,
      donnees: [{ id: "a1", titre: "Nouveautés", texte: "Texte", lien: null, auteur: "Aïcha Kpadé", creeLe: "2026-10-14T10:00:00+00:00", destinataires: 12 }],
    });
    faux.repondre("rpc.annonces_equipe", { error: { code: "42883" } });
    expect(await lireAnnonces()).toEqual({ migrationAbsente: true });
  });
});
