import { describe, expect, it } from "vitest";
import { EnvError, readPublicEnv } from "@/lib/env";

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const fakeJwt = (payload: object) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.signature`;

const URL_OK = "https://abcd.supabase.co";

function readError(source: Record<string, string | undefined>): EnvError {
  try {
    readPublicEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error;
    throw error;
  }
  throw new Error("readPublicEnv aurait dû lever une EnvError");
}

describe("readPublicEnv", () => {
  it("accepte une URL et une clé publishable", () => {
    expect(
      readPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " https://abcd.supabase.co/ ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz",
      }),
    ).toEqual({ supabaseUrl: "https://abcd.supabase.co", supabaseKey: "sb_publishable_xyz" });
  });

  it("accepte une clé anon au format JWT", () => {
    const key = fakeJwt({ role: "anon" });
    expect(readPublicEnv({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key }).supabaseKey).toBe(key);
  });

  it("refuse une URL vide", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: "  ", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(error.message).toContain("web/.env.local");
  });

  it("refuse une URL sans https", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: "abcd.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_xyz" });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_URL");
    expect(error.message).toContain("https://");
  });

  it("refuse une clé vide", () => {
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  });

  it("refuse une clé secrète sb_secret_", () => {
    const secret = "sb_secret_NE_DOIT_JAMAIS_APPARAITRE";
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(error.variable).toBe("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(error.message).toContain("secrète");
    expect(error.message).not.toContain(secret);
  });

  it("refuse un JWT service_role", () => {
    const secret = fakeJwt({ role: "service_role" });
    const error = readError({ NEXT_PUBLIC_SUPABASE_URL: URL_OK, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secret });
    expect(error.message).toContain("secrète");
    expect(error.message).not.toContain(secret);
  });
});
