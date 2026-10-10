import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Doublures : Supabase, cookies et redirection de Next ──────────────────
const auth = { signUp: vi.fn(), verifyOtp: vi.fn(), resend: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers({ host: "localhost:3000" }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { resendCode, signUp, verifyCode } = await import("@/lib/auth/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const form = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const INSCRIPTION = { prenom: "Aïcha", nom: "Kpadé", email: " Aicha.K@Exemple.com", password: "motdepasse", conditions: "on" };

describe("Inscription", () => {
  beforeEach(() => {
    jar.clear();
    Object.values(auth).forEach((f) => f.mockReset());
  });

  it("l'inscription mène au code", async () => {
    auth.signUp.mockResolvedValue({ data: { user: { id: "u1", identities: [{}] } }, error: null });
    await expect(signUp(IDLE, form(INSCRIPTION))).rejects.toThrow("NEXT_REDIRECT:/verification-email");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "aicha.k@exemple.com",
      password: "motdepasse",
      options: { data: { prenom: "Aïcha", nom: "Kpadé" } },
    });
    expect(jar.get("etudium-verification")).toBe("aicha.k@exemple.com");
  });

  it("une saisie incomplète garde les champs sauf le mot de passe", async () => {
    const state = await signUp(IDLE, form({ ...INSCRIPTION, conditions: "" }));
    expect(state.status).toBe("error");
    expect(state.fieldErrors?.conditions).toBe("Acceptez les conditions pour créer votre compte.");
    expect(state.values).toEqual({ prenom: "Aïcha", nom: "Kpadé", email: " Aicha.K@Exemple.com" });
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it("une erreur de Supabase est traduite", async () => {
    auth.signUp.mockResolvedValue({ data: {}, error: { code: "over_email_send_rate_limit", status: 429 } });
    const state = await signUp(IDLE, form(INSCRIPTION));
    expect(state.message).toBe("Trop de demandes. Patientez une minute, puis réessayez.");
  });
});

describe("Code de vérification", () => {
  beforeEach(() => {
    jar.clear();
    Object.values(auth).forEach((f) => f.mockReset());
  });

  it("le bon code ouvre l'accueil", async () => {
    jar.set("etudium-verification", "aicha.k@exemple.com");
    auth.verifyOtp.mockResolvedValue({ error: null });
    await expect(verifyCode(IDLE, form({ code: "482913" }))).rejects.toThrow("NEXT_REDIRECT:/accueil");
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "aicha.k@exemple.com", token: "482913", type: "email" });
    expect(jar.has("etudium-verification")).toBe(false);
  });

  it("un mauvais code l'annonce", async () => {
    jar.set("etudium-verification", "aicha.k@exemple.com");
    auth.verifyOtp.mockResolvedValue({ error: { code: "otp_expired", status: 403 } });
    const state = await verifyCode(IDLE, form({ code: "111111" }));
    expect(state.message).toBe("Ce code est incorrect ou a expiré. Demandez-en un nouveau.");
  });

  it("un code incomplet est refusé avant d'appeler Supabase", async () => {
    jar.set("etudium-verification", "aicha.k@exemple.com");
    const state = await verifyCode(IDLE, form({ code: "4829" }));
    expect(state.fieldErrors?.code).toBe("Saisissez les 6 chiffres du code.");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("sans adresse en attente, retour à l'inscription", async () => {
    await expect(verifyCode(IDLE, form({ code: "482913" }))).rejects.toThrow("NEXT_REDIRECT:/inscription");
  });

  it("le renvoi du code est confirmé", async () => {
    jar.set("etudium-verification", "aicha.k@exemple.com");
    auth.resend.mockResolvedValue({ error: null });
    const state = await resendCode(IDLE);
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "aicha.k@exemple.com" });
    expect(state).toEqual({ status: "success", message: "Un nouveau code vous a été envoyé." });
  });
});
