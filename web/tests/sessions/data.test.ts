import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Lectures des sessions live (migration 0018).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { lireProchaineSession, lireSessionDetail, lireSessions, lireSessionsAnimees, lireSessionsEquipe } = await import("@/lib/sessions/data");

const ID = "11111111-1111-4111-8111-111111111111";
const P = "22222222-2222-4222-8222-222222222222";
const CARTE = {
  id: ID,
  titre: "Excel avancé",
  description: "Analyse de données",
  debut: "2026-10-24T14:00:00+00:00",
  duree_minutes: 60,
  plateforme: "Google Meet",
  lien: null,
  parcours: { nom_court: "Académique", couleur: "academique" },
  animateur: "Dr Mireille Adjovi",
  inscriptions: 128,
  inscrit: true,
  statut: "programmee",
};
const CONVERTIE = {
  id: ID,
  titre: "Excel avancé",
  description: "Analyse de données",
  debut: "2026-10-24T14:00:00+00:00",
  dureeMinutes: 60,
  plateforme: "Google Meet",
  lien: null,
  parcours: { nomCourt: "Académique", couleur: "academique" },
  animateur: "Dr Mireille Adjovi",
  inscriptions: 128,
  inscrit: true,
  statut: "programmee",
};
const LIGNE = { id: ID, titre: "Excel avancé", debut: "2026-10-24T14:00:00+00:00", duree_minutes: 60, plateforme: "Zoom", statut: "annulee", inscriptions: 3, parcours: null, animateur: "Équipe Étudium" };
const LIGNE_CONVERTIE = { id: ID, titre: "Excel avancé", debut: "2026-10-24T14:00:00+00:00", dureeMinutes: 60, plateforme: "Zoom", statut: "annulee", inscriptions: 3, parcours: null, animateur: "Équipe Étudium" };

beforeEach(() => faux.vider());

describe("Lectures des sessions", () => {
  it("les cartes d'un onglet, converties ; la vue est transmise", async () => {
    faux.repondre("rpc.sessions_live", { data: [CARTE] });
    expect(await lireSessions("inscriptions")).toEqual({ migrationAbsente: false, donnees: [CONVERTIE] });
    expect(faux.de("rpc", "sessions_live")[0].valeurs).toEqual({ p_vue: "inscriptions" });
  });

  it("la prochaine session, avec ses initiales ; null sans session", async () => {
    faux.repondre("rpc.prochaine_session", { data: { ...CARTE, initiales: ["RH", "FA"] } });
    expect(await lireProchaineSession()).toEqual({ migrationAbsente: false, donnees: { ...CONVERTIE, initiales: ["RH", "FA"] } });
    faux.repondre("rpc.prochaine_session", { data: null });
    expect(await lireProchaineSession()).toEqual({ migrationAbsente: false, donnees: null });
  });

  it("les listes de l'animateur et de l'équipe", async () => {
    faux.repondre("rpc.sessions_animees", { data: { a_venir: [LIGNE], passees: [] } });
    expect(await lireSessionsAnimees()).toEqual({ migrationAbsente: false, donnees: { aVenir: [LIGNE_CONVERTIE], passees: [] } });
    faux.repondre("rpc.sessions_equipe", { data: { a_venir: [], passees: [LIGNE] } });
    expect(await lireSessionsEquipe()).toEqual({ migrationAbsente: false, donnees: { aVenir: [], passees: [LIGNE_CONVERTIE] } });
  });

  it("la fiche d'une session ; null pour un identifiant mal formé, sans appel", async () => {
    faux.repondre("rpc.session_detail", {
      data: {
        ...CARTE,
        lien: "https://meet.google.com/abc",
        parcours: { id: P, nom_court: "Académique", couleur: "academique" },
        formateur_id: null,
        annulee_le: null,
        inscrits: [{ prenom: "Fifamè", nom: "Adjovi" }],
      },
    });
    expect(await lireSessionDetail(ID)).toEqual({
      migrationAbsente: false,
      donnees: {
        id: ID,
        titre: "Excel avancé",
        description: "Analyse de données",
        debut: "2026-10-24T14:00:00+00:00",
        dureeMinutes: 60,
        plateforme: "Google Meet",
        lien: "https://meet.google.com/abc",
        parcours: { id: P, nomCourt: "Académique", couleur: "academique" },
        formateurId: null,
        animateur: "Dr Mireille Adjovi",
        statut: "programmee",
        annuleeLe: null,
        inscrits: [{ prenom: "Fifamè", nom: "Adjovi" }],
        promoImage: null,
        promoVideo: null,
      },
    });
    expect(faux.de("rpc", "session_detail")[0].valeurs).toEqual({ p_session: ID });
    faux.vider();
    expect(await lireSessionDetail("abc")).toEqual({ migrationAbsente: false, donnees: null });
    expect(faux.appels).toEqual([]);
  });

  it("avant la 0018 : migrationAbsente ; toute autre erreur est relancée", async () => {
    faux.repondre("rpc.sessions_live", { error: { code: "PGRST202" } });
    expect(await lireSessions("a_venir")).toEqual({ migrationAbsente: true });
    faux.repondre("rpc.sessions_equipe", { error: { code: "500", message: "panne" } });
    await expect(lireSessionsEquipe()).rejects.toThrow();
  });
});
