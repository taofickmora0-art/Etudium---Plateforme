import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { getUser: vi.fn() };
const update = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth, rpc, from: () => ({ update: (v: unknown) => (update(v), { eq: async () => ({ error: null }) }) }) }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { choisirObjectif, updatePreferences } = await import("@/lib/profile/actions");
const { readPreferences } = await import("@/lib/profile/preferences");

describe("Enregistrer ses préférences", () => {
  beforeEach(() => {
    [auth.getUser, update].forEach((f) => f.mockReset());
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  });

  it("les préférences sont enregistrées en entier", async () => {
    const prefs = { ...readPreferences({}), annonces: false };
    expect(await updatePreferences(prefs)).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith({ preferences_notifications: prefs });
  });

  it("un objet invalide n'est pas enregistré", async () => {
    expect(await updatePreferences({ annonces: "oui" } as never)).toEqual({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });
});

describe("Choisir son objectif de la semaine (lot 6 B)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("3, 5 ou 7 jours, enregistrés par la base", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await choisirObjectif(3)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("choisir_objectif", { p_jours: 3 });
  });

  it("une autre valeur n'est pas envoyée ; un refus de la base est rendu", async () => {
    expect(await choisirObjectif(4)).toEqual({ ok: false });
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "absente" } });
    expect(await choisirObjectif(7)).toEqual({ ok: false });
  });
});
