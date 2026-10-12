import { beforeEach, describe, expect, it, vi } from "vitest";

// /auth/sortie : la coque y envoie quand Supabase ne reconnaît plus la session (fermée sur un autre appareil).
const auth = { getUser: vi.fn() };
let baseJoignable = true;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!baseJoignable) throw new Error("NEXT_PUBLIC_SUPABASE_URL manquante");
    return { auth };
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
}));

const { GET } = await import("@/app/auth/sortie/route");
const requete = (suite = "") => new Request(`http://localhost:3000/auth/sortie${suite}`) as never;

describe("Sortie d'une session fermée ailleurs", () => {
  beforeEach(() => {
    auth.getUser.mockReset();
    baseJoignable = true;
    jar.clear();
    jar.set("sb-projet-auth-token", "jeton").set("etudium-souvenir", "1").set("autre", "garde");
  });

  it("une session encore valable n'est pas fermée par ce lien", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const reponse = await GET(requete());
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/accueil");
    expect([...jar.keys()]).toEqual(["sb-projet-auth-token", "etudium-souvenir", "autre"]);
  });

  it("si la base est injoignable, la sortie mène tout de même à la connexion", async () => {
    baseJoignable = false;
    const reponse = await GET(requete());
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/connexion?session=expiree");
  });

  it("un incident passager de Supabase n'efface pas la session", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0, message: "fetch failed" } });
    const reponse = await GET(requete());
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/accueil");
    expect(jar.has("sb-projet-auth-token")).toBe(true);
  });

  it("une session fermée ailleurs est effacée de l'appareil", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found", status: 403 } });
    const reponse = await GET(requete());
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/connexion?session=expiree");
    expect([...jar.keys()]).toEqual(["autre"]);
  });

  it("après une session fermée ailleurs, la reconnexion ramène à la page demandée", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found", status: 403 } });
    const reponse = await GET(requete("?next=%2Fprofil"));
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/connexion?session=expiree&next=%2Fprofil");
  });

  it("une page demandée hors du site est ignorée", async () => {
    auth.getUser.mockResolvedValue({ data: { user: null }, error: { code: "session_not_found", status: 403 } });
    for (const piege of ["%2F%2Fpirate.example", "https%3A%2F%2Fpirate.example", "%2F.%2F%2Fpirate.example"]) {
      const reponse = await GET(requete(`?next=${piege}`));
      expect(reponse.headers.get("location"), piege).toBe("http://localhost:3000/connexion?session=expiree");
    }
  });
});
