import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { default: VitrinePage } = await import("@/app/vitrine/page");

describe("Vitrine des composants", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("n'existe pas sur le site en ligne", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => VitrinePage()).toThrow("NEXT_NOT_FOUND");
  });

  it("reste disponible sur l'ordinateur de développement", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(() => VitrinePage()).not.toThrow();
  });
});
