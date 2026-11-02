import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// Quand la file se vide (lot 5, étape B) : après la réponse (after()), au chargement de la cloche, après un message,
// une annonce, une suspension ou une réactivation. Hors d'une requête (tests, scripts), after() lève : rien ne casse.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const after = vi.fn((tache: () => unknown) => void tache());
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (t: () => unknown) => after(t) }));
const viderFile = vi.fn(async () => ({ envoyes: 0, echecs: 0 }));
vi.mock("@/lib/envois/file", () => ({ viderFile: () => viderFile() }));

const { viderFileApres } = await import("@/lib/envois/declencher");
const { chargerCloche, publierAnnonce } = await import("@/lib/notifications/actions");
const { envoyerMessage } = await import("@/lib/messages/actions");
const { suspendreCompte, reactiverCompte } = await import("@/lib/utilisateurs/actions");

const C = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  faux.vider();
  after.mockClear();
  viderFile.mockClear();
  getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
});

describe("Vider la file après la réponse", () => {
  it("viderFileApres confie viderFile à after() ; hors d'une requête, after() lève et rien ne casse", () => {
    viderFileApres();
    expect(after).toHaveBeenCalledTimes(1);
    expect(viderFile).toHaveBeenCalledTimes(1);
    after.mockImplementationOnce(() => {
      throw new Error("`after` was called outside a request scope.");
    });
    expect(() => viderFileApres()).not.toThrow();
  });

  it("la cloche vide la file, au plus une fois toutes les 10 secondes (point reporté) ; sans session, non", async () => {
    faux.repondre("rpc.mes_notifications", { data: { lignes: [], suite: false, non_lues: 0 } });
    await chargerCloche();
    expect(viderFile).toHaveBeenCalledTimes(1);
    await chargerCloche();
    expect(viderFile).toHaveBeenCalledTimes(1);
    const plusTard = Date.now() + 11_000;
    const horloge = vi.spyOn(Date, "now").mockReturnValue(plusTard);
    await chargerCloche();
    expect(viderFile).toHaveBeenCalledTimes(2);
    horloge.mockRestore();
    viderFile.mockClear();
    getShellUser.mockResolvedValue(null);
    vi.spyOn(Date, "now").mockReturnValueOnce(plusTard + 60_000);
    await chargerCloche();
    expect(viderFile).not.toHaveBeenCalled();
  });

  it("une annonce publiée, un message envoyé : la file se vide ; un refus de la base, non", async () => {
    faux.repondre("rpc.publier_annonce", { data: 3 });
    await publierAnnonce("Nouveautés", "La page est en ligne.", "");
    expect(viderFile).toHaveBeenCalledTimes(1);
    faux.repondre("rpc.envoyer_message", { data: { id: C, conversation_id: C, auteur: C, texte: "Bonjour", cree_le: "2026-11-01T10:00:00Z", de_moi: true } });
    await envoyerMessage(C, "Bonjour", null);
    expect(viderFile).toHaveBeenCalledTimes(2);
    faux.repondre("rpc.envoyer_message", { error: { code: "500", message: "panne" } });
    await envoyerMessage(C, "Bonjour", null);
    expect(viderFile).toHaveBeenCalledTimes(2);
  });

  it("une suspension, une réactivation : l'e-mail part sans attendre une cloche", async () => {
    getShellUser.mockResolvedValue({ roles: ["etudiant", "super_admin"] });
    await suspendreCompte(C, "Motif");
    await reactiverCompte(C);
    expect(viderFile).toHaveBeenCalledTimes(2);
  });
});
