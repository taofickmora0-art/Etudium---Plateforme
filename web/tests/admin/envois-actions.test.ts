import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCES_DOMAINE, ACCES_EQUIPE, SESSION_EXPIREE } from "@/lib/admin/garde";
import { MIGRATION_ENVOIS, SANS_CLE_ENVOIS } from "@/lib/admin/envois/types";
import { jetonEnvois } from "@/lib/envois/config";
import { fauxSupabase } from "./faux-supabase";

// « Activer les envois » au back-office (mise en ligne, migration 0071) : comme « Activer les paiements », l'action
// donne à la base l'empreinte du jeton du serveur, tiré de la clé Resend (à défaut, de la clé privée VAPID). Réservé
// aux administrateurs ; la clé et le jeton ne quittent jamais le serveur : l'écran ne reçoit que leur état.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { activerEnvois } = await import("@/lib/admin/envois/actions");
const { lireEtatEnvois } = await import("@/lib/admin/envois/data");
const { refresh } = await import("next/cache");

const CLE = "re_test_cle_resend";
const JETON = jetonEnvois({ RESEND_API_KEY: CLE })!;

beforeEach(() => {
  faux.vider();
  vi.mocked(refresh).mockClear();
  getShellUser.mockResolvedValue({ prenom: "Awa", nom: "K", roles: ["etudiant", "admin"] });
  vi.stubEnv("RESEND_API_KEY", CLE);
  vi.stubEnv("EMAIL_EXPEDITEUR", "Étudium <equipe@etudium.online>");
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
  vi.stubEnv("VAPID_PRIVATE_KEY", "");
  vi.stubEnv("VAPID_SUJET", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("« Activer les envois »", () => {
  it("session expirée, hors équipe, modérateur : refusé, sans appel", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await activerEnvois()).toEqual({ ok: false, message: SESSION_EXPIREE });
    getShellUser.mockResolvedValue({ prenom: "Koffi", nom: "D", roles: ["etudiant"] });
    expect(await activerEnvois()).toEqual({ ok: false, message: ACCES_EQUIPE });
    getShellUser.mockResolvedValue({ prenom: "Koffi", nom: "D", roles: ["formateur"] });
    expect(await activerEnvois()).toEqual({ ok: false, message: ACCES_EQUIPE });
    getShellUser.mockResolvedValue({ prenom: "Mo", nom: "D", roles: ["moderateur"] });
    expect(await activerEnvois()).toEqual({ ok: false, message: ACCES_DOMAINE });
    expect(faux.appels).toEqual([]);
  });

  it("sans clé Resend ni clé VAPID : le message, sans appel", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await activerEnvois()).toEqual({ ok: false, message: SANS_CLE_ENVOIS });
    expect(SANS_CLE_ENVOIS).toBe("Ajoutez RESEND_API_KEY ou les clés VAPID dans les variables du site, puis redéployez.");
    expect(faux.appels).toEqual([]);
  });

  it("un admin (ou un super admin) : la base reçoit le jeton tiré de la clé Resend ; la page est rafraîchie", async () => {
    expect(await activerEnvois()).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_jeton_envois").map((a) => a.valeurs)).toEqual([{ p_jeton: JETON }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    getShellUser.mockResolvedValue({ prenom: "Sam", nom: "A", roles: ["super_admin"] });
    expect(await activerEnvois()).toEqual({ ok: true });
  });

  it("sans clé Resend : le jeton tiré de la clé privée VAPID", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "cle-privee-vapid");
    expect(await activerEnvois()).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_jeton_envois")[0].valeurs).toEqual({ p_jeton: jetonEnvois({ VAPID_PRIVATE_KEY: "cle-privee-vapid" }) });
  });

  it("la fonction absente : « Appliquez la migration 0071 » ; un refus de la base : son message ; le reste : un message simple", async () => {
    expect(MIGRATION_ENVOIS).toBe("Appliquez la migration 0071 (guide « Mise en ligne »).");
    for (const code of ["PGRST202", "42883"]) {
      faux.repondre("rpc.enregistrer_jeton_envois", { error: { code, message: "Could not find the function" } });
      expect(await activerEnvois()).toEqual({ ok: false, message: MIGRATION_ENVOIS });
    }
    faux.repondre("rpc.enregistrer_jeton_envois", { error: { code: "42501", message: "Réservé aux administrateurs." } });
    expect(await activerEnvois()).toEqual({ ok: false, message: "Réservé aux administrateurs." });
    faux.repondre("rpc.enregistrer_jeton_envois", { error: { code: "08006", message: "connexion perdue" } });
    expect(await activerEnvois()).toEqual({ ok: false, message: "L’opération n’a pas abouti. Réessayez." });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("L'état des envois", () => {
  it("actifs : le jeton du serveur est reconnu ; les canaux selon leurs clés ; ni la clé ni le jeton ne sortent", async () => {
    faux.repondre("rpc.etat_envois", { data: "actifs" });
    const etat = await lireEtatEnvois();
    expect(etat).toEqual({ etat: "actifs", email: true, push: false });
    expect(faux.de("rpc", "etat_envois")[0].valeurs).toEqual({ p_jeton: JETON });
    expect(JSON.stringify(etat)).not.toContain(CLE);
    expect(JSON.stringify(etat)).not.toContain(JETON);
  });

  it("à activer : jeton pas encore enregistré, clé changée, ou migration absente", async () => {
    faux.repondre("rpc.etat_envois", { data: "a_activer" });
    expect((await lireEtatEnvois()).etat).toBe("a_activer");
    faux.repondre("rpc.etat_envois", { error: { code: "PGRST202", message: "Could not find the function" } });
    expect((await lireEtatEnvois()).etat).toBe("a_activer");
  });

  it("sans clé : « sans clé », sans appel à la base", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect(await lireEtatEnvois()).toEqual({ etat: "sans_cle", email: false, push: false });
    expect(faux.appels).toEqual([]);
  });

  it("le push seul : jeton de la clé VAPID, push prêt, e-mails non", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "BPub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "cle-privee-vapid");
    vi.stubEnv("VAPID_SUJET", "mailto:equipe@etudium.online");
    faux.repondre("rpc.etat_envois", { data: "actifs" });
    expect(await lireEtatEnvois()).toEqual({ etat: "actifs", email: false, push: true });
    expect(faux.de("rpc", "etat_envois")[0].valeurs).toEqual({ p_jeton: jetonEnvois({ VAPID_PRIVATE_KEY: "cle-privee-vapid" }) });
  });
});
