import { beforeEach, describe, expect, it, vi } from "vitest";

const appels: string[] = [];
const auth = { getUser: vi.fn(), signInWithPassword: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { changePassword } = await import("@/lib/profile/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};

describe("Changer de mot de passe", () => {
  beforeEach(() => {
    appels.length = 0;
    Object.values(auth).forEach((f) => f.mockReset());
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "aicha.k@exemple.com" } }, error: null });
    auth.signInWithPassword.mockImplementation(async () => (appels.push("verifier"), { error: null }));
    auth.updateUser.mockImplementation(async () => (appels.push("changer"), { error: null }));
    auth.signOut.mockImplementation(async () => (appels.push("deconnecter"), { error: null }));
  });

  it("un mot de passe actuel faux est signalé sans rien changer", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const state = await changePassword(IDLE, form({ current: "faux", password: "nouveaumdp" }));
    expect(state.fieldErrors?.current).toBe("Le mot de passe actuel est incorrect.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("le nouveau mot de passe déconnecte les autres appareils", async () => {
    const state = await changePassword(IDLE, form({ current: "motdepasse", password: "nouveaumdp" }));
    expect(state.status).toBe("success");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "aicha.k@exemple.com", password: "motdepasse" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nouveaumdp" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(appels).toEqual(["verifier", "changer", "deconnecter"]);
  });

  it("un nouveau mot de passe identique est refusé clairement", async () => {
    auth.updateUser.mockResolvedValue({ error: { code: "same_password", status: 422 } });
    const state = await changePassword(IDLE, form({ current: "motdepasse", password: "motdepasse" }));
    expect(state.message).toBe("Choisissez un mot de passe différent de l’ancien.");
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
