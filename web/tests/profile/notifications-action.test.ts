import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { getUser: vi.fn() };
const update = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth, from: () => ({ update: (v: unknown) => (update(v), { eq: async () => ({ error: null }) }) }) }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { updatePreferences } = await import("@/lib/profile/actions");
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
