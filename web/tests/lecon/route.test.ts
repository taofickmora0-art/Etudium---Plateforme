import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXCEL, id } from "./donnees";

const getFiche = vi.fn();
vi.mock("@/lib/catalogue/data", () => ({ getFiche: (slug: string) => getFiche(slug) }));
vi.mock("@/lib/lecon/data", () => ({ getLecon: vi.fn() }));
vi.mock("@/lib/catalogue/visiteur", () => ({ compteConnecte: vi.fn() }));
vi.mock("@/components/layout/CompteDeLEntete", () => ({ CompteDeLEntete: () => null }));

const { generateMetadata } = await import("@/app/(lecon)/formations/[slug]/lecons/[leconId]/page");
const avec = (slug: string, leconId: string) => ({ params: Promise.resolve({ slug, leconId }) });

describe("Page leçon : métadonnées", () => {
  beforeEach(() => {
    getFiche.mockReset();
  });

  it("le titre nomme la leçon et la formation ; la page n'est pas référencée (la fiche l'est)", async () => {
    getFiche.mockResolvedValue(EXCEL);
    const meta = await generateMetadata(avec("maitriser-microsoft-excel", id(1)));
    expect(meta.title).toBe("Découvrir l’interface · Maîtriser Microsoft Excel · Étudium");
    expect(meta.robots).toMatchObject({ index: false });
  });

  it("une leçon inconnue, ou une base injoignable, donne « Leçon introuvable »", async () => {
    getFiche.mockResolvedValue(EXCEL);
    expect((await generateMetadata(avec("maitriser-microsoft-excel", id(99)))).title).toBe("Leçon introuvable · Étudium");
    getFiche.mockRejectedValue(new Error("panne"));
    expect((await generateMetadata(avec("maitriser-microsoft-excel", id(1)))).title).toBe("Leçon introuvable · Étudium");
  });
});
