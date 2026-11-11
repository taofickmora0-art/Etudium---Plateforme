// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Doublures : Supabase, cookies et redirection de Next ──────────────────
const auth = { signInWithPassword: vi.fn(), resend: vi.fn(), signInWithOAuth: vi.fn(), signOut: vi.fn(), exchangeCodeForSession: vi.fn() };
const rpc = vi.fn();
const createClient = vi.fn(async (options?: unknown) => {
  void options;
  return { auth, rpc };
});
vi.mock("@/lib/supabase/server", () => ({ createClient: (options?: unknown) => createClient(options) }));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (name: string, value: string) => jar.set(name, value),
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const { signIn, signInWithGoogle } = await import("@/lib/auth/actions");
const { GET: retourGoogle } = await import("@/app/auth/callback/route");
const { IDLE } = await import("@/lib/auth/schemas");

function form(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

const BONS = { email: "aicha.k@exemple.com", password: "motdepasse", remember: "on" };

describe("Connexion", () => {
  beforeEach(() => {
    jar.clear();
    Object.values(auth).forEach((f) => f.mockReset());
    createClient.mockClear();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: false, error: null });
  });

  it("un compte suspendu est refusé et aussitôt déconnecté", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    const state = await signIn(IDLE, form(BONS));
    expect(state).toMatchObject({ status: "error", message: "Ce compte est suspendu. Pour en savoir plus, contactez l’équipe Étudium." });
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("au retour de Google, un compte suspendu revient à la connexion avec le message", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ data: true, error: null });
    const reponse = await retourGoogle(new Request("http://localhost:3000/auth/callback?code=abc&next=/accueil") as never);
    expect(auth.signOut).toHaveBeenCalled();
    expect(reponse.headers.get("location")).toBe("/connexion?erreur=suspendu");
  });

  it("au retour de Google, un compte actif va à la page demandée", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const reponse = await retourGoogle(new Request("http://localhost:3000/auth/callback?code=abc&next=/certificats") as never);
    expect(auth.signOut).not.toHaveBeenCalled();
    expect(reponse.headers.get("location")).toBe("/certificats");
  });

  it("de bons identifiants mènent à l'accueil", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn(IDLE, form(BONS))).rejects.toThrow("NEXT_REDIRECT:/accueil");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "aicha.k@exemple.com", password: "motdepasse" });
    expect(jar.get("etudium-souvenir")).toBe("1");
    expect(createClient).toHaveBeenCalledWith({ remember: true });
  });

  it("un formateur sans « Étudiant » arrive dans son espace : son tableau de bord, ou l'équivalent de la page demandée (R1)", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    rpc.mockImplementation(async (nom: string, args?: { r?: string }) => ({ data: nom === "a_role" && args?.r === "formateur", error: null }));
    await expect(signIn(IDLE, form(BONS))).rejects.toThrow("NEXT_REDIRECT:/formateur");
    await expect(signIn(IDLE, form({ ...BONS, next: "/profil" }))).rejects.toThrow("NEXT_REDIRECT:/formateur/profil");
    auth.exchangeCodeForSession.mockResolvedValue({ error: null });
    const reponse = await retourGoogle(new Request("http://localhost:3000/auth/callback?code=abc&next=/accueil") as never);
    expect(reponse.headers.get("location")).toBe("/formateur");
  });

  it("sans « Se souvenir de moi », la session s'arrête à la fermeture du navigateur", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn(IDLE, form({ email: BONS.email, password: BONS.password }))).rejects.toThrow("NEXT_REDIRECT:/accueil");
    expect(jar.get("etudium-souvenir")).toBe("0");
    expect(createClient).toHaveBeenCalledWith({ remember: false });
  });

  it("de mauvais identifiants l'annoncent sans renvoyer le mot de passe", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const state = await signIn(IDLE, form(BONS));
    expect(state).toMatchObject({ status: "error", message: "E-mail ou mot de passe incorrect." });
    expect(state.values).toEqual({ email: "aicha.k@exemple.com", remember: "1" });
  });

  it("après une erreur, le choix « Se souvenir de moi » est gardé", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "invalid_credentials", status: 400 } });
    const { remember, ...sansSouvenir } = BONS;
    void remember;
    expect((await signIn(IDLE, form(sansSouvenir))).values?.remember).toBe("0");
    expect((await signIn(IDLE, form({ email: "pas-une-adresse", password: "x" }))).values?.remember).toBe("0");
  });

  it("un compte non vérifié repart vers le code", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: { code: "email_not_confirmed", status: 400 } });
    auth.resend.mockResolvedValue({ error: null });
    await expect(signIn(IDLE, form(BONS))).rejects.toThrow("NEXT_REDIRECT:/verification-email");
    expect(auth.resend).toHaveBeenCalledWith({ type: "signup", email: "aicha.k@exemple.com" });
    expect(jar.get("etudium-verification")).toBe("aicha.k@exemple.com");
  });

  it("Google respecte « Se souvenir de moi »", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o" }, error: null });
    await expect(signInWithGoogle(form({ next: "/accueil" }))).rejects.toThrow("NEXT_REDIRECT:https://accounts.google.com/o");
    expect(jar.get("etudium-souvenir")).toBe("0");
    await expect(signInWithGoogle(form({ next: "/accueil", remember: "on" }))).rejects.toThrow("NEXT_REDIRECT:https://accounts.google.com/o");
    expect(jar.get("etudium-souvenir")).toBe("1");
  });

  it("un échec de Google garde la page demandée", async () => {
    auth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: { status: 500 } });
    await expect(signInWithGoogle(form({ next: "/certificats" }))).rejects.toThrow("NEXT_REDIRECT:/connexion?erreur=google&next=%2Fcertificats");
    const reponse = await retourGoogle(new Request("http://localhost:3000/auth/callback?next=/certificats") as never);
    expect(reponse.headers.get("location")).toBe("/connexion?erreur=google&next=%2Fcertificats");
  });

  it("le retour reste sur l'adresse par laquelle on est venu (le téléphone passe par l'adresse réseau de l'ordinateur)", async () => {
    // En développement, request.url dit toujours localhost : une adresse relative laisse le navigateur garder la sienne.
    const venu = new Request("http://localhost:3000/auth/callback?next=/certificats", { headers: { host: "192.168.0.3:3000" } });
    const reponse = await retourGoogle(venu as never);
    expect(reponse.status).toBe(307);
    expect(reponse.headers.get("location")).toBe("/connexion?erreur=google&next=%2Fcertificats");
  });

  it("next ne fait pas sortir du site", async () => {
    auth.signInWithPassword.mockResolvedValue({ error: null });
    await expect(signIn(IDLE, form({ ...BONS, next: "https://pirate.example" }))).rejects.toThrow("NEXT_REDIRECT:/accueil");
    await expect(signIn(IDLE, form({ ...BONS, next: "/certificats" }))).rejects.toThrow("NEXT_REDIRECT:/certificats");
  });

  it("sans base configurée, un message clair au lieu d'une panne", async () => {
    createClient.mockRejectedValueOnce(new Error("Configuration manquante"));
    const state = await signIn(IDLE, form(BONS));
    expect(state).toMatchObject({ status: "error", message: "Une erreur est survenue. Vérifiez votre connexion, puis réessayez." });
  });
});
