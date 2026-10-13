import { expect, it, vi } from "vitest";

// Le client Supabase lit l'heure dès sa création (expiration du jeton) : il ne doit naître qu'à une vraie requête,
// jamais pendant le pré-rendu, sinon Next signale « Date.now() while prerendering » (Cache Components).
const ordre: string[] = [];
vi.mock("next/headers", () => ({
  cookies: async () => {
    ordre.push("cookies");
    return { getAll: () => [], get: () => undefined, set: () => {} };
  },
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  connection: async () => {
    ordre.push("connection");
  },
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => {
    ordre.push("client");
    return {};
  },
}));
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ supabaseUrl: "https://projet.supabase.co", supabaseKey: "cle-publique" }) }));

const { createClient } = await import("@/lib/supabase/server");

it("le client Supabase n'est créé qu'à la requête : cookies, puis connection, puis le client", async () => {
  await createClient();
  expect(ordre).toEqual(["cookies", "connection", "client"]);
});
