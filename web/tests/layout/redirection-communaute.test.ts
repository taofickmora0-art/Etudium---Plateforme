import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// L'Accueil est la communauté (spec du nouvel Accueil, §4) : `/communaute` y mène (Next garde la requête, donc `?espace=`) ;
// la page d'une publication garde son adresse.
describe("La redirection de /communaute", () => {
  it("vers /accueil, temporaire ; les pages de publication ne sont pas visées", async () => {
    const regles = (await nextConfig.redirects?.()) ?? [];
    expect(regles).toContainEqual({ source: "/communaute", destination: "/accueil", permanent: false });
    expect(regles.some((r) => r.source.startsWith("/communaute/"))).toBe(false);
  });
});
