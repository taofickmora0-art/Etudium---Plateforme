import { describe, expect, it, vi } from "vitest";

// Pendant la compilation, Next met en attente toute lecture des cookies (la page sera rendue à la requête).
vi.mock("next/headers", () => ({ cookies: () => new Promise(() => {}) }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL est vide");
  },
}));

const { createClient } = await import("@/lib/supabase/server");

describe("Client Supabase côté serveur", () => {
  it("la compilation sans configuration ne fait pas échouer les pages : les cookies sont lus d'abord", async () => {
    const issue = await Promise.race([
      createClient().then(
        () => "client",
        () => "erreur",
      ),
      new Promise((resolve) => setTimeout(() => resolve("en attente"), 50)),
    ]);
    expect(issue).toBe("en attente");
  });
});
