import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Doublures : Supabase (session + table profils) et rafraîchissement de Next ───
const auth = { getUser: vi.fn() };
const update = vi.fn();
const eq = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth,
    from: () => ({
      update: (valeurs: unknown) => {
        update(valeurs);
        return { eq: async (col: string, val: string) => (eq(col, val), { error: null }) };
      },
    }),
  }),
}));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { updateProfile } = await import("@/lib/profile/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const SAISIE = { prenom: "Aïcha", nom: "Kpadé", telephone: "", pays: "benin", niveau_etudes: "", etablissement: "", filiere: "", objectifs: "" };

describe("Enregistrer ses informations", () => {
  beforeEach(() => {
    [auth.getUser, update, eq, refresh].forEach((f) => f.mockReset());
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  });

  it("les informations sont enregistrées pour le compte connecté", async () => {
    const state = await updateProfile(IDLE, form(SAISIE));
    expect(state.status).toBe("success");
    expect(update).toHaveBeenCalledWith({
      prenom: "Aïcha",
      nom: "Kpadé",
      telephone: null,
      pays: "benin",
      niveau_etudes: null,
      etablissement: null,
      filiere: null,
      objectifs: null,
    });
    expect(eq).toHaveBeenCalledWith("id", "u1");
    expect(refresh).toHaveBeenCalled();
  });

  it("une saisie invalide n'écrit rien", async () => {
    const state = await updateProfile(IDLE, form({ ...SAISIE, prenom: "" }));
    expect(state.fieldErrors?.prenom).toBe("Entrez votre prénom.");
    expect(state.values?.nom).toBe("Kpadé");
    expect(update).not.toHaveBeenCalled();
  });

  it("sans session, rien n'est écrit", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found", status: 403 } });
    const state = await updateProfile(IDLE, form(SAISIE));
    expect(state).toMatchObject({ status: "error", message: "Votre session a expiré. Reconnectez-vous." });
    expect(update).not.toHaveBeenCalled();
  });
});
