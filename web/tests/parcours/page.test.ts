import { describe, expect, it, vi } from "vitest";
import { CARTES_DESIGN, PARCOURS_DESIGN } from "../catalogue/cartes-design";

const lireProgression = vi.fn();
vi.mock("@/lib/catalogue/data", () => ({ listCatalogue: async () => CARTES_DESIGN, listParcoursCatalogue: async () => PARCOURS_DESIGN }));
vi.mock("@/lib/progression/data", () => ({ lireProgression: () => lireProgression() }));

const { PageMesParcours } = await import("@/components/parcours/PageMesParcours");

type Element = { props: { progressions: Map<string, { pourcentage: number; terminee: boolean }>; initial?: string } };

describe("Page Mes parcours : progression", () => {
  it("les progressions viennent de la base (leçons terminées ÷ leçons)", async () => {
    const excel = CARTES_DESIGN.find((c) => c.slug === "maitriser-microsoft-excel")!;
    lireProgression.mockResolvedValue(
      ["a", "b", "c"].map((leconId) => ({ leconId, formationId: excel.id, termineeLe: "2026-10-12T10:00:00Z", vueLe: "2026-10-12T10:00:00Z", positionSecondes: 0 })),
    );
    const element = (await PageMesParcours()) as unknown as Element;
    expect(element.props.progressions.get("maitriser-microsoft-excel")).toEqual({ pourcentage: Math.round((100 * 3) / excel.nbLecons), terminee: false });
  });

  it("le parcours demandé dans l'adresse (?parcours=) est transmis à la page", async () => {
    lireProgression.mockResolvedValue(null);
    const element = (await PageMesParcours({ searchParams: Promise.resolve({ parcours: "competences-digitales" }) })) as unknown as Element;
    expect(element.props.initial).toBe("competences-digitales");
    const double = (await PageMesParcours({ searchParams: Promise.resolve({ parcours: ["business-revenus-en-ligne", "x"] }) })) as unknown as Element;
    expect(double.props.initial).toBe("business-revenus-en-ligne");
  });

  it("sans progression en base (migrations 0007 et 0008 absentes), tout est à 0 %", async () => {
    lireProgression.mockResolvedValue(null);
    const element = (await PageMesParcours()) as unknown as Element;
    expect(element.props.progressions.size).toBe(0);
  });
});
