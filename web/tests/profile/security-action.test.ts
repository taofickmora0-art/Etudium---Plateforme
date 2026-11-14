import { beforeEach, describe, expect, it, vi } from "vitest";

const appels: string[] = [];
const auth = { getUser: vi.fn(), signInWithPassword: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), signInWithOtp: vi.fn(), verifyOtp: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth }) }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const { changePassword, creerMotDePasse, envoyerCodeMotDePasse } = await import("@/lib/profile/actions");
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

describe("Créer un mot de passe, pour un compte Google (14 novembre 2026)", () => {
  beforeEach(() => {
    appels.length = 0;
    Object.values(auth).forEach((f) => f.mockReset());
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1", email: "equipe@etudium.online" } }, error: null });
    auth.signInWithOtp.mockResolvedValue({ error: null });
    auth.verifyOtp.mockImplementation(async () => (appels.push("verifier"), { data: { user: { id: "u1" } }, error: null }));
    auth.updateUser.mockImplementation(async () => (appels.push("creer"), { error: null }));
  });
  const formulaire = (code = "123456", confirmation = "nouveaumdp") => form({ password: "nouveaumdp", confirmation, code });

  it("le code part à l'adresse du compte (sans jamais créer de compte)", async () => {
    expect(await envoyerCodeMotDePasse()).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: "equipe@etudium.online", options: { shouldCreateUser: false } });
    auth.signInWithOtp.mockResolvedValue({ error: { code: "over_email_send_rate_limit", status: 429 } });
    expect(await envoyerCodeMotDePasse()).toMatchObject({ ok: false });
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await envoyerCodeMotDePasse()).toEqual({ ok: false, message: "Votre session a expiré. Reconnectez-vous." });
  });

  it("le code est vérifié par Supabase d'abord, puis le mot de passe est créé et noté sur le compte", async () => {
    expect(await creerMotDePasse(IDLE, formulaire())).toEqual({ status: "success" });
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "equipe@etudium.online", token: "123456", type: "email" });
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "nouveaumdp", data: { mot_de_passe: true } });
    expect(appels).toEqual(["verifier", "creer"]);
  });

  it("un code faux ou expiré : rien n'est créé ; des mots de passe différents : pas même la vérification", async () => {
    auth.verifyOtp.mockResolvedValue({ data: { user: null }, error: { code: "otp_expired", status: 403 } });
    expect(await creerMotDePasse(IDLE, formulaire("000000"))).toEqual({ status: "error", fieldErrors: { code: "Ce code est incorrect ou a expiré. Demandez-en un nouveau." } });
    expect(auth.updateUser).not.toHaveBeenCalled();
    auth.verifyOtp.mockClear();
    expect((await creerMotDePasse(IDLE, formulaire("123456", "autre1234"))).fieldErrors?.confirmation).toBe("Les deux mots de passe ne correspondent pas.");
    expect((await creerMotDePasse(IDLE, formulaire("12"))).fieldErrors?.code).toBe("Saisissez les 6 chiffres du code.");
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });
});
