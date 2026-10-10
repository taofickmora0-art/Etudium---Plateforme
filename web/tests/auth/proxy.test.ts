import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

// Supabase renouvelle la session : il écrit les cookies et fournit des en-têtes qui interdisent toute mise en cache
// (sinon une réponse portant le jeton d'une personne pourrait être resservie à une autre).
const ENTETES = { "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0", Expires: "0", Pragma: "no-cache" };
vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _cle: string, { cookies }: { cookies: { setAll: (c: unknown[], h: Record<string, string>) => void } }) => ({
    auth: {
      getClaims: async () => {
        cookies.setAll([{ name: "sb-projet-auth-token", value: "jeton-renouvele", options: { path: "/" } }], ENTETES);
        return { data: { claims: { sub: "u1" } }, error: null };
      },
    },
  }),
}));
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ supabaseUrl: "https://projet.supabase.co", supabaseKey: "cle-publique" }) }));

const { proxy } = await import("@/proxy");

describe("Proxy", () => {
  it("une page servie avec une session renouvelée n'est jamais mise en cache", async () => {
    const reponse = await proxy(new NextRequest("http://localhost:3000/accueil"));
    expect(reponse.headers.get("location")).toBeNull();
    expect(reponse.cookies.get("sb-projet-auth-token")?.value).toBe("jeton-renouvele");
    expect(reponse.headers.get("cache-control")).toContain("no-store");
  });

  it("la redirection garde les cookies renouvelés et l'interdiction de mise en cache", async () => {
    const reponse = await proxy(new NextRequest("http://localhost:3000/connexion"));
    expect(reponse.headers.get("location")).toBe("http://localhost:3000/accueil");
    expect(reponse.cookies.get("sb-projet-auth-token")?.value).toBe("jeton-renouvele");
    expect(reponse.headers.get("cache-control")).toContain("no-store");
  });
});
