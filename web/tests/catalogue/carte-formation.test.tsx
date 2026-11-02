// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CarteFormation } from "@/components/catalogue/CarteFormation";
import { parSlug } from "./cartes-design";

describe("Carte de formation", () => {
  it("titre h2 par défaut, h3 sur demande (cartes sous le titre d'une section)", () => {
    const { unmount } = render(<CarteFormation carte={parSlug("maitriser-microsoft-excel")} />);
    expect(screen.getByRole("heading", { level: 2, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
    unmount();
    render(<CarteFormation carte={parSlug("maitriser-microsoft-excel")} titleAs="h3" />);
    expect(screen.getByRole("heading", { level: 3, name: "Maîtriser Microsoft Excel" })).toBeInTheDocument();
  });
});
