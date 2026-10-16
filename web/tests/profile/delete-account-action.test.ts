import { beforeEach, describe, expect, it, vi } from "vitest";

const appels: string[] = [];
const auth = { getUser: vi.fn() };
const stockage = { list: vi.fn(), remove: vi.fn() };
const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth,
    rpc: (nom: string) => rpc(nom),
    storage: { from: (espace: string) => ({ list: stockage.list, remove: (chemins: string[]) => stockage.remove(chemins, espace) }) },
    from: () => ({ update: (v: unknown) => (appels.push(`profil ${JSON.stringify(v)}`), { eq: async () => ({ error: null }) }) }),
  }),
}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    delete: (name: string) => (appels.push(`cookie ${name}`), jar.delete(name)),
  }),
}));

const { deleteAccount } = await import("@/lib/profile/actions");

describe("Supprimer son compte", () => {
  beforeEach(() => {
    appels.length = 0;
    jar.clear();
    jar.set("sb-projet-auth-token", "jeton").set("etudium-souvenir", "1");
    [auth.getUser, stockage.list, stockage.remove, rpc].forEach((f) => f.mockReset());
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    stockage.list.mockResolvedValue({ data: [{ name: "a.jpg" }], error: null });
    stockage.remove.mockImplementation(async (chemins: string[], espace: string) => (appels.push(`${espace} ${chemins.join(",")}`), { error: null }));
    rpc.mockImplementation(async (nom: string) => (appels.push(`rpc ${nom}`), { error: null }));
  });

  it("la suppression efface la photo puis le compte, puis la session de l'appareil", async () => {
    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(appels).toEqual([
      "photos-profil u1/a.jpg",
      `profil {"photo_url":null}`,
      "rpc oublier_mes_rendus",
      "rpc fichiers_de_mes_messages",
      "rpc supprimer_mon_compte",
      "cookie sb-projet-auth-token",
      "cookie etudium-souvenir",
    ]);
    expect(jar.size).toBe(0);
  });

  it("ses travaux rendus (exercices) sont effacés avant le compte", async () => {
    rpc.mockImplementation(async (nom: string) => (appels.push(`rpc ${nom}`), nom === "oublier_mes_rendus" ? { data: ["u1/l1/v1.pdf"], error: null } : { error: null }));
    await deleteAccount();
    expect(appels.slice(2, 5)).toEqual(["rpc oublier_mes_rendus", "rendus u1/l1/v1.pdf", "rpc fichiers_de_mes_messages"]);
  });

  it("ses conversations partent avec le compte ; leurs fichiers, listés avant, sont effacés juste après", async () => {
    const fichiers = ["u1/c1/a.pdf", "f2/c1/b.pdf"];
    rpc.mockImplementation(async (nom: string) => (appels.push(`rpc ${nom}`), nom === "fichiers_de_mes_messages" ? { data: fichiers, error: null } : { error: null }));
    await deleteAccount();
    expect(appels.slice(3, 6)).toEqual(["rpc fichiers_de_mes_messages", "rpc supprimer_mon_compte", "messages u1/c1/a.pdf,f2/c1/b.pdf"]);
  });

  it("compte refusé (suspendu) : aucun fichier des messages n'est effacé", async () => {
    rpc.mockImplementation(async (nom: string) =>
      nom === "fichiers_de_mes_messages" ? { data: ["u1/c1/a.pdf"], error: null } : nom === "supprimer_mon_compte" ? { error: { message: "Ce compte est suspendu." } } : { error: null },
    );
    await expect(deleteAccount()).rejects.toThrow();
    expect(appels.some((a) => a.startsWith("messages "))).toBe(false);
  });

  it("compte supprimé mais fichiers des messages non effacés : la session est fermée quand même", async () => {
    rpc.mockImplementation(async (nom: string) => (appels.push(`rpc ${nom}`), nom === "fichiers_de_mes_messages" ? { data: ["u1/c1/a.pdf"], error: null } : { error: null }));
    stockage.remove.mockImplementation(async (chemins: string[], espace: string) => (espace === "messages" ? { data: null, error: { message: "refus" } } : { error: null }));
    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(appels).toContain("rpc supprimer_mon_compte");
    expect(jar.size).toBe(0);
  });

  it("si la base refuse, rien n'est effacé sur l'appareil et l'erreur remonte", async () => {
    rpc.mockResolvedValue({ error: { message: "refus" } });
    await expect(deleteAccount()).rejects.toThrow();
    expect(jar.has("sb-projet-auth-token")).toBe(true);
  });

  it("si les photos ne peuvent pas être effacées, le compte n'est pas supprimé", async () => {
    stockage.remove.mockResolvedValue({ data: null, error: { message: "refus" } });
    await expect(deleteAccount()).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    stockage.remove.mockReset();
    stockage.list.mockResolvedValue({ data: null, error: { message: "refus" } });
    await expect(deleteAccount()).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("sans session, rien n'est supprimé", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found" } });
    await expect(deleteAccount()).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
    expect(stockage.remove).not.toHaveBeenCalled();
  });
});
