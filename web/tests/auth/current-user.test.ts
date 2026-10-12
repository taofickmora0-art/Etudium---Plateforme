import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Doublures : Supabase (session + tables), configuration, cookies et redirection ───
const auth = { getUser: vi.fn(), signOut: vi.fn() };
const tables: Record<string, { data: unknown; error: unknown }> = {};
const from = vi.fn((table: string) => {
  const resultat = () => tables[table] ?? { data: null, error: null };
  const requete = {
    select: () => requete,
    eq: () => requete,
    maybeSingle: async () => resultat(),
    then: (ok: (v: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(resultat()).then(ok, ko),
  };
  return requete;
});
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth, from }) }));

let configuree = true;
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => {
    if (!configuree) throw new Error("NEXT_PUBLIC_SUPABASE_URL manquante");
    return { supabaseUrl: "https://projet.supabase.co", supabaseKey: "cle-publique" };
  },
}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
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

const { getShellUser } = await import("@/lib/auth/current-user");
const { signOut } = await import("@/lib/auth/actions");

// getUser interroge Supabase : une session fermée ailleurs (mot de passe changé, compte supprimé) n'y est plus valable.
const session = (champs: Record<string, unknown>) => ({ data: { user: { id: "u1", email: "aicha.k@exemple.com", ...champs } }, error: null });

describe("Compte affiché par la coque", () => {
  beforeEach(() => {
    configuree = true;
    Object.values(auth).forEach((f) => f.mockReset());
    for (const t of Object.keys(tables)) delete tables[t];
  });

  it("une session fermée ailleurs ne donne plus de compte", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found", status: 403 } });
    expect(await getShellUser()).toBeNull();
  });

  it("un incident passager de Supabase ne passe pas pour une session fermée", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } });
    await expect(getShellUser()).rejects.toThrow();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthApiError", status: 503, message: "indisponible" } });
    await expect(getShellUser()).rejects.toThrow();
  });

  it("la coque affiche l'adresse publique de la photo", async () => {
    auth.getUser.mockResolvedValue(session({}));
    tables.profils = { data: { prenom: "Aïcha", nom: "Kpadé", photo_url: "u1/a.jpg" }, error: null };
    tables.roles = { data: [{ role: "etudiant" }], error: null };
    expect((await getShellUser())?.photoUrl).toBe("https://projet.supabase.co/storage/v1/object/public/photos-profil/u1/a.jpg");
  });

  it("une photo enregistrée avant la migration 0003 (adresse complète) reste affichée", async () => {
    auth.getUser.mockResolvedValue(session({}));
    tables.profils = { data: { photo_url: "https://projet.supabase.co/storage/v1/object/public/photos-profil/u1/a.jpg" }, error: null };
    expect((await getShellUser())?.photoUrl).toBe("https://projet.supabase.co/storage/v1/object/public/photos-profil/u1/a.jpg");
  });

  it("une valeur qui n'est pas un chemin de photo donne les initiales", async () => {
    auth.getUser.mockResolvedValue(session({}));
    for (const forgee of ["https://ailleurs.example/pixel.png", "../autre/a.jpg", "/u1/a.jpg", "u1/a.jpg?x=1"]) {
      tables.profils = { data: { photo_url: forgee }, error: null };
      expect((await getShellUser())?.photoUrl, forgee).toBeNull();
    }
  });

  it("getShellUser lit le profil et les rôles", async () => {
    auth.getUser.mockResolvedValue(session({ user_metadata: { prenom: "Ancien", nom: "Nom" } }));
    tables.profils = { data: { prenom: "Aïcha", nom: "Kpadé" }, error: null };
    tables.roles = { data: [{ role: "etudiant" }], error: null };
    const user = await getShellUser();
    expect(user).toMatchObject({ prenom: "Aïcha", nom: "Kpadé", initials: "AK", email: "aicha.k@exemple.com", roles: ["etudiant"] });
    expect(user).toMatchObject({ serie: 0, points: 0, formule: "Gratuite", statut: "Étudiant·e" });
  });

  it("les rôles suivent l'ordre du menu", async () => {
    auth.getUser.mockResolvedValue(session({}));
    tables.profils = { data: { prenom: "Aïcha", nom: "Kpadé" }, error: null };
    tables.roles = { data: [{ role: "admin" }, { role: "etudiant" }, { role: "formateur" }], error: null };
    expect((await getShellUser())?.roles).toEqual(["etudiant", "formateur", "admin"]);
  });

  it("sans profil, getShellUser se rabat sur les données d'inscription", async () => {
    auth.getUser.mockResolvedValue(session({ user_metadata: { prenom: "Aïcha", nom: "Kpadé" } }));
    tables.profils = { data: null, error: null };
    tables.roles = { data: [], error: null };
    expect(await getShellUser()).toMatchObject({ prenom: "Aïcha", nom: "Kpadé", initials: "AK", roles: ["etudiant"] });
  });

  it("un compte Google donne son prénom et son nom", async () => {
    auth.getUser.mockResolvedValue(session({ user_metadata: { full_name: "Koffi Jean Mensah" } }));
    tables.profils = { data: null, error: { code: "PGRST000" } };
    expect(await getShellUser()).toMatchObject({ prenom: "Koffi", nom: "Jean Mensah", initials: "KJ" });
  });

  it("sans nom du tout, l'initiale vient de l'adresse", async () => {
    auth.getUser.mockResolvedValue(session({ user_metadata: {} }));
    tables.profils = { data: { prenom: "", nom: "" }, error: null };
    expect((await getShellUser())?.initials).toBe("A");
  });

  it("sans session, personne", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await getShellUser()).toBeNull();
  });

  it("en mode démonstration, l'utilisatrice des écrans du design", async () => {
    configuree = false;
    vi.stubEnv("NODE_ENV", "development");
    const user = await getShellUser();
    vi.unstubAllEnvs();
    expect(user).toMatchObject({ prenom: "Aïcha", nom: "Kpadé", roles: ["etudiant", "formateur", "admin"] });
    expect(auth.getUser).not.toHaveBeenCalled();
  });
});

describe("Déconnexion", () => {
  // Accolades : une fonction renvoyée par beforeEach serait appelée comme nettoyage (mockReset renvoie la doublure).
  beforeEach(() => {
    auth.signOut.mockReset();
    jar.clear();
    jar.set("etudium-souvenir", "1").set("sb-projet-auth-token", "jeton").set("sb-projet-auth-token.1", "suite").set("autre", "garde");
  });

  // Pas de redirection côté serveur : l'écran recharge entièrement la page de connexion (rien du compte ne reste en mémoire).
  it("la déconnexion ferme la session de cet appareil", async () => {
    auth.signOut.mockResolvedValue({ error: null });
    await expect(signOut()).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect([...jar.keys()]).toEqual(["autre"]);
  });

  it("même si la base ne répond pas, cet appareil est déconnecté", async () => {
    auth.signOut.mockRejectedValue(new Error("réseau"));
    await expect(signOut()).resolves.toBeUndefined();
    expect([...jar.keys()]).toEqual(["autre"]);
  });
});
