import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_EXPIREE } from "@/lib/admin/garde";
import { fauxSupabase } from "../admin/faux-supabase";

// Enregistrer et retirer un appareil pour le push (migration 0058) : la base revérifie le compte et les limites.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));

const { enregistrerAppareil, retirerAppareil } = await import("@/lib/envois/actions");

const APPAREIL = { adresse: "https://fcm.googleapis.com/fcm/send/abc", p256dh: "B" + "x".repeat(86), auth: "a".repeat(22) };
const ECHEC = "Cet appareil n’a pas pu être enregistré. Réessayez.";

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ roles: ["etudiant"] });
});

describe("Les appareils du push", () => {
  it("enregistrer : la fonction de la base avec l'adresse et les clés", async () => {
    expect(await enregistrerAppareil(APPAREIL)).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_appareil")[0].valeurs).toEqual({ p_adresse: APPAREIL.adresse, p_p256dh: APPAREIL.p256dh, p_auth: APPAREIL.auth });
  });

  it("refusé sans session, ou avec une adresse qui n'est pas en https ou trop longue, sans appel", async () => {
    expect(await enregistrerAppareil({ ...APPAREIL, adresse: "http://push.exemple/abc" })).toEqual({ ok: false, message: ECHEC });
    expect(await enregistrerAppareil({ ...APPAREIL, adresse: "https://fcm.googleapis.com/fcm/send/" + "x".repeat(1000) })).toEqual({ ok: false, message: ECHEC });
    // Relecture (4) : seules les adresses des services de push ; jamais un serveur choisi par le compte.
    expect(await enregistrerAppareil({ ...APPAREIL, adresse: "https://intranet.exemple/x" })).toEqual({ ok: false, message: ECHEC });
    expect(await enregistrerAppareil({ ...APPAREIL, adresse: "https://fcm.googleapis.com.ailleurs.exemple/x" })).toEqual({ ok: false, message: ECHEC });
    expect(await enregistrerAppareil({ ...APPAREIL, auth: "" })).toEqual({ ok: false, message: ECHEC });
    getShellUser.mockResolvedValue(null);
    expect(await enregistrerAppareil(APPAREIL)).toEqual({ ok: false, message: SESSION_EXPIREE });
    expect(faux.appels).toEqual([]);
  });

  it("migration absente : le message neutre ; autre erreur : le message d'échec", async () => {
    faux.repondre("rpc.enregistrer_appareil", { error: { code: "PGRST202", message: "absent" } });
    expect(await enregistrerAppareil(APPAREIL)).toEqual({ ok: false, message: "Cette fonction n’est pas disponible pour le moment." });
    faux.repondre("rpc.enregistrer_appareil", { error: { code: "500", message: "panne" } });
    expect(await enregistrerAppareil(APPAREIL)).toEqual({ ok: false, message: ECHEC });
  });

  it("retirer : la fonction de la base ; sans session, rien", async () => {
    expect(await retirerAppareil(APPAREIL.adresse)).toEqual({ ok: true });
    expect(faux.de("rpc", "retirer_appareil")[0].valeurs).toEqual({ p_adresse: APPAREIL.adresse });
    faux.vider();
    getShellUser.mockResolvedValue(null);
    expect(await retirerAppareil(APPAREIL.adresse)).toEqual({ ok: false, message: SESSION_EXPIREE });
    expect(faux.appels).toEqual([]);
  });
});
