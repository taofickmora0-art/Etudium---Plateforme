import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCES_EDITEUR, SESSION_EXPIREE } from "@/lib/admin/garde";
import type { DonneesSession } from "@/lib/sessions/types";
import { fauxSupabase } from "../admin/faux-supabase";

// Actions des sessions live : onglets et inscription (tout compte), programmation (formateur et équipe).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { annulerSession, chargerSessions, creerSession, modifierSession, seDesinscrire, sinscrire } = await import("@/lib/sessions/actions");

const ID = "11111111-1111-4111-8111-111111111111";
const FICHE = "33333333-3333-4333-8333-333333333333";
const MIGRATION = "Appliquez la migration 0018 (guide « Ce qui te revient », section 23).";
const INDISPONIBLE = "Cette fonction n’est pas disponible pour le moment.";
// Toujours dans le futur, quelle que soit la date du jour : dans 30 jours.
const dans30 = new Date(Date.now() + 30 * 86_400_000);
const D: DonneesSession = {
  titre: " Excel avancé ",
  description: "",
  date: new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(dans30),
  heure: "15:00",
  dureeMinutes: 60,
  lien: "https://meet.google.com/abc-defg-hij",
  parcoursId: null,
  formateurId: FICHE,
};

beforeEach(() => {
  faux.vider();
  refresh.mockReset();
  getShellUser.mockResolvedValue({ roles: ["etudiant"] });
});

describe("Onglets et inscription", () => {
  it("chargerSessions : la vue ; refus sans session ; avant la 0018", async () => {
    faux.repondre("rpc.sessions_live", { data: [] });
    expect(await chargerSessions("passees")).toEqual({ ok: true, sessions: [] });
    expect(faux.de("rpc", "sessions_live")[0].valeurs).toEqual({ p_vue: "passees" });
    faux.repondre("rpc.sessions_live", { error: { code: "PGRST202" } });
    expect(await chargerSessions("a_venir")).toEqual({ ok: false, message: INDISPONIBLE });
    getShellUser.mockResolvedValue(null);
    expect(await chargerSessions("a_venir")).toEqual({ ok: false, message: SESSION_EXPIREE });
  });

  it("sinscrire et seDesinscrire : la fonction de la base, son refus tel quel, la page relue ; identifiant mal formé sans appel", async () => {
    expect(await sinscrire(ID)).toEqual({ ok: true });
    expect(await seDesinscrire(ID)).toEqual({ ok: true });
    expect(faux.de("rpc", "sinscrire_session")[0].valeurs).toEqual({ p_session: ID });
    expect(faux.de("rpc", "se_desinscrire_session")[0].valeurs).toEqual({ p_session: ID });
    expect(refresh).toHaveBeenCalledTimes(2);
    faux.repondre("rpc.sinscrire_session", { error: { code: "P0001", message: "Les inscriptions à cette session sont closes." } });
    expect(await sinscrire(ID)).toEqual({ ok: false, message: "Les inscriptions à cette session sont closes." });
    faux.vider();
    expect(await sinscrire("abc")).toMatchObject({ ok: false });
    expect(faux.appels).toEqual([]);
  });
});

describe("Programmer, modifier, annuler", () => {
  it("refusé à un étudiant, sans appel ; une donnée invalide est refusée avant tout appel", async () => {
    expect(await creerSession(D)).toEqual({ ok: false, message: ACCES_EDITEUR });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    expect(await creerSession({ ...D, lien: "http://x" })).toEqual({ ok: false, message: "Le lien doit commencer par https://" });
    expect(faux.appels).toEqual([]);
  });

  it("le formateur crée : début en heure du Bénin, l'animateur n'est pas transmis ; l'équipe le transmet", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    faux.repondre("rpc.creer_session", { data: ID });
    expect(await creerSession(D)).toEqual({ ok: true, id: ID });
    expect(faux.de("rpc", "creer_session")[0].valeurs).toEqual({
      p_titre: "Excel avancé",
      p_description: "",
      p_debut: `${D.date}T15:00:00+01:00`,
      p_duree: 60,
      p_lien: "https://meet.google.com/abc-defg-hij",
      p_parcours: null,
      p_formateur: null,
    });
    expect(refresh).toHaveBeenCalled();
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    await creerSession(D);
    expect(faux.de("rpc", "creer_session")[1].valeurs).toMatchObject({ p_formateur: FICHE });
  });

  it("relecture du lot 6 A (critique) : le modérateur programme, modifie et annule une session (domaine de la communauté)", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "moderateur"] });
    faux.repondre("rpc.creer_session", { data: ID });
    expect(await creerSession(D)).toEqual({ ok: true, id: ID });
    expect(faux.de("rpc", "creer_session")[0].valeurs).toMatchObject({ p_formateur: FICHE });
    expect(await modifierSession(ID, D)).toEqual({ ok: true });
    expect(await annulerSession(ID)).toEqual({ ok: true });
  });

  it("le début se lit dans le fuseau du formateur (son appareil) ; un fuseau inconnu : le Bénin", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    faux.repondre("rpc.creer_session", { data: ID });
    await creerSession({ ...D, fuseau: "Africa/Lome" });
    expect(faux.de("rpc", "creer_session")[0].valeurs).toMatchObject({ p_debut: `${D.date}T15:00:00+00:00` });
    await creerSession({ ...D, fuseau: "Pas/Un_Fuseau" });
    expect(faux.de("rpc", "creer_session")[1].valeurs).toMatchObject({ p_debut: `${D.date}T15:00:00+01:00` });
  });

  it("modifier : sans revérifier le début (la base le fait s'il change) ; annuler ; refus et migration absente", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "formateur"] });
    expect(await modifierSession(ID, { ...D, date: "2020-01-01" })).toEqual({ ok: true });
    expect(faux.de("rpc", "modifier_session")[0].valeurs).toMatchObject({ p_session: ID, p_debut: "2020-01-01T15:00:00+01:00" });
    expect(await annulerSession(ID)).toEqual({ ok: true });
    expect(faux.de("rpc", "annuler_session")[0].valeurs).toEqual({ p_session: ID });
    faux.repondre("rpc.annuler_session", { error: { code: "P0001", message: "Une session terminée ne se modifie plus." } });
    expect(await annulerSession(ID)).toEqual({ ok: false, message: "Une session terminée ne se modifie plus." });
    faux.repondre("rpc.creer_session", { error: { code: "PGRST202" } });
    expect(await creerSession(D)).toEqual({ ok: false, message: INDISPONIBLE });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "moderateur"] });
    expect(await creerSession(D)).toEqual({ ok: false, message: MIGRATION });
  });
});
