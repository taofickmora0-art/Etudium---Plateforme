import { beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";

// « S'inscrire à ce cours » (migration 0069 ; spec du 2 novembre 2026, §2 et §5) : la base inscrit le compte connecté et
// refuse en français ; la fiche, « Mes formations », le catalogue et les favoris se relisent.
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser() }));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));

const { sInscrireFormation } = await import("@/lib/inscriptions/actions");

const FORMATION = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  faux.vider();
  revalidatePath.mockReset();
  getShellUser.mockReset().mockResolvedValue({ id: "moi" });
});

describe("sInscrireFormation", () => {
  it("inscrit le compte par la base, puis relit la fiche, « Mes formations », le catalogue et les favoris", async () => {
    faux.repondre("rpc.s_inscrire_formation", { data: "2026-11-02T10:00:00+00:00" });
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: true });
    expect(faux.de("rpc", "s_inscrire_formation")[0].valeurs).toEqual({ p_formation: FORMATION });
    const relues = revalidatePath.mock.calls.map((appel) => appel.join(" "));
    expect(relues).toEqual(expect.arrayContaining(["/formations/[slug] page", "/formations/[slug]/lecons/[leconId] page", "/mes-formations", "/formations", "/favoris"]));
  });

  it("le refus de la base est rendu tel quel, en français", async () => {
    const refus = "Cette formation est réservée aux abonnés : un abonnement ouvre toutes les formations.";
    faux.repondre("rpc.s_inscrire_formation", { error: { code: "42501", message: refus } });
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: false, message: refus });
    faux.repondre("rpc.s_inscrire_formation", { error: { code: "P0001", message: "Cette formation n'est pas disponible." } });
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: false, message: "Cette formation n’est pas disponible." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("sans la migration 0069 : « Appliquez la migration 0069 », avec la section du guide ; une autre erreur : un message clair", async () => {
    faux.repondre("rpc.s_inscrire_formation", { error: { code: "PGRST202", message: "Could not find the function" } });
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: false, message: "Appliquez la migration 0069 (guide « Ce qui te revient », section 68)." });
    faux.repondre("rpc.s_inscrire_formation", { error: { code: "42883", message: "function does not exist" } });
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: false, message: "Appliquez la migration 0069 (guide « Ce qui te revient », section 68)." });
    faux.repondre("rpc.s_inscrire_formation", { error: { code: "57014", message: "canceling statement due to statement timeout" } });
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: false, message: "L’inscription n’a pas abouti. Réessayez." });
  });

  it("session expirée ou identifiant invalide : rien n'est demandé à la base", async () => {
    getShellUser.mockResolvedValue(null);
    expect(await sInscrireFormation(FORMATION)).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
    getShellUser.mockResolvedValue({ id: "moi" });
    expect(await sInscrireFormation("pas-un-id")).toEqual({ ok: false, message: "L’inscription n’a pas abouti. Réessayez." });
    expect(faux.appels).toEqual([]);
  });
});
