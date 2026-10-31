import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { resetPasswordForEmail: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), verifyOtp: vi.fn(), getClaims: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
  headers: async () => new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { requestReset, updatePassword } = await import("@/lib/auth/actions");
const { IDLE } = await import("@/lib/auth/schemas");
const { GET } = await import("@/app/auth/confirm/route");

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};

describe("Mot de passe oublié", () => {
  beforeEach(() => Object.values(auth).forEach((f) => f.mockReset()));

  it("la réponse est la même que le compte existe ou non", async () => {
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const existe = await requestReset(IDLE, form({ email: "aicha.k@exemple.com" }));
    auth.resetPasswordForEmail.mockResolvedValueOnce({ error: { code: "user_not_found", status: 404 } });
    const inconnu = await requestReset(IDLE, form({ email: "personne@exemple.com" }));
    expect(existe.status).toBe("success");
    expect(inconnu.status).toBe("success");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("aicha.k@exemple.com", {
      redirectTo: "http://localhost:3000/auth/confirm?next=/nouveau-mot-de-passe",
    });
  });

  it("la limite d'envoi ne trahit pas l'existence d'un compte", async () => {
    // Supabase n'applique la limite par adresse qu'aux comptes existants : « Renvoyer le lien » aussitôt
    // dirait « Trop de demandes » pour un compte existant et « succès » pour une adresse inconnue.
    auth.resetPasswordForEmail.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });
    const state = await requestReset(IDLE, form({ email: "aicha.k@exemple.com" }));
    expect(state).toEqual({ status: "success", values: { email: "aicha.k@exemple.com" } });
  });
});

// Session ouverte par le lien reçu par e-mail : Supabase l'inscrit comme « otp » (vérification du lien), datée en secondes.
const maintenant = () => Math.floor(Date.now() / 1000);
const session = (amr: unknown) => ({ data: { claims: { sub: "u1", amr } }, error: null });

describe("Nouveau mot de passe", () => {
  beforeEach(() => {
    Object.values(auth).forEach((f) => f.mockReset());
    auth.getClaims.mockResolvedValue(session([{ method: "otp", timestamp: maintenant() - 60 }]));
  });

  it("le nouveau mot de passe déconnecte les autres appareils", async () => {
    auth.updateUser.mockResolvedValue({ error: null });
    auth.signOut.mockResolvedValue({ error: null });
    await expect(updatePassword(IDLE, form({ password: "nouveaumdp", confirmation: "nouveaumdp" }))).rejects.toThrow("NEXT_REDIRECT:/accueil");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nouveaumdp" });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("sans session (lien expiré), on le dit", async () => {
    auth.updateUser.mockResolvedValue({ error: { name: "AuthSessionMissingError", status: 400 } });
    const state = await updatePassword(IDLE, form({ password: "nouveaumdp", confirmation: "nouveaumdp" }));
    expect(state.message).toBe("Ce lien a expiré. Demandez-en un nouveau.");
  });

  it("une session ouverte par mot de passe ne suffit pas : il faut le lien reçu par e-mail", async () => {
    auth.getClaims.mockResolvedValue(session([{ method: "password", timestamp: maintenant() - 60 }]));
    const state = await updatePassword(IDLE, form({ password: "nouveaumdp", confirmation: "nouveaumdp" }));
    expect(state.message).toBe("Ce lien a expiré. Demandez-en un nouveau.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("un lien utilisé il y a plus de 15 minutes ne suffit plus", async () => {
    auth.getClaims.mockResolvedValue(session([{ method: "otp", timestamp: maintenant() - 16 * 60 }]));
    const state = await updatePassword(IDLE, form({ password: "nouveaumdp", confirmation: "nouveaumdp" }));
    expect(state.message).toBe("Ce lien a expiré. Demandez-en un nouveau.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("les deux mots de passe doivent correspondre", async () => {
    const state = await updatePassword(IDLE, form({ password: "nouveaumdp", confirmation: "autre" }));
    expect(state.fieldErrors?.confirmation).toBe("Les deux mots de passe ne correspondent pas.");
    expect(auth.updateUser).not.toHaveBeenCalled();
  });
});

describe("Lien reçu par e-mail", () => {
  beforeEach(() => Object.values(auth).forEach((f) => f.mockReset()));

  it("/auth/confirm ouvre la page demandée", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(new Request("http://localhost:3000/auth/confirm?token_hash=abc&type=recovery&next=/nouveau-mot-de-passe") as never);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: "abc" });
    expect(res.headers.get("location")).toBe("/nouveau-mot-de-passe");
  });

  it("/auth/confirm refuse un next extérieur", async () => {
    auth.verifyOtp.mockResolvedValue({ error: null });
    const res = await GET(new Request("http://localhost:3000/auth/confirm?token_hash=abc&type=recovery&next=https://pirate.example") as never);
    expect(res.headers.get("location")).toBe("/accueil");
  });

  it("un lien expiré mène à une nouvelle demande", async () => {
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    const res = await GET(new Request("http://localhost:3000/auth/confirm?token_hash=abc&type=recovery") as never);
    expect(res.headers.get("location")).toBe("/mot-de-passe-oublie?lien=expire");
  });
});
