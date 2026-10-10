import { describe, expect, it } from "vitest";
import { checkSupabase } from "@/lib/supabase/health";

const env = { supabaseUrl: "https://abcd.supabase.co", supabaseKey: "sb_publishable_xyz" };

const respond = (status: number): typeof fetch => async () => new Response("{}", { status });

describe("checkSupabase", () => {
  it("appelle /auth/v1/health avec la clé en en-tête apikey", async () => {
    let calledUrl = "";
    let apikey: string | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      calledUrl = String(input);
      apikey = new Headers(init?.headers).get("apikey");
      return new Response("{}", { status: 200 });
    };
    await checkSupabase(env, fetchImpl);
    expect(calledUrl).toBe("https://abcd.supabase.co/auth/v1/health");
    expect(apikey).toBe("sb_publishable_xyz");
  });

  it("renvoie ok quand Supabase répond 200", async () => {
    expect(await checkSupabase(env, respond(200))).toEqual({ ok: true });
  });

  it("renvoie cle quand Supabase répond 401", async () => {
    expect(await checkSupabase(env, respond(401))).toEqual({
      ok: false,
      reason: "cle",
      message: "Supabase refuse la clé : vérifiez NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans web/.env.local.",
    });
  });

  it("renvoie injoignable en cas d'erreur réseau", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await checkSupabase(env, fetchImpl)).toEqual({
      ok: false,
      reason: "injoignable",
      message: "Supabase ne répond pas : vérifiez l’URL et votre connexion, ou réactivez le projet s’il est en pause.",
    });
  });

  it("renvoie injoignable après le délai", async () => {
    const neverAnswers: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    const started = Date.now();
    const status = await checkSupabase(env, neverAnswers, 50);
    expect(status.ok).toBe(false);
    expect(status.ok === false && status.reason).toBe("injoignable");
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("renvoie pause quand le projet est en pause (code 540)", async () => {
    expect(await checkSupabase(env, respond(540))).toEqual({
      ok: false,
      reason: "pause",
      message: "Le projet Supabase est en pause : réactivez-le depuis son tableau de bord (bouton « Restore project »).",
    });
  });

  it("explique la restriction quand le projet est restreint (code 402)", async () => {
    const status = await checkSupabase(env, respond(402));
    expect(status.ok === false && status.message).toContain("restreint");
  });

  it("renvoie inconnu pour un autre statut", async () => {
    const status = await checkSupabase(env, respond(500));
    expect(status.ok === false && status.reason).toBe("inconnu");
    expect(status.ok === false && status.message).toContain("500");
  });
});
