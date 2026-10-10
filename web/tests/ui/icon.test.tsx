// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vitest";
import { Icon } from "@/components/ui/Icon";

describe("Icon", () => {
  it("est décorative sans libellé", () => {
    const { container } = render(<Icon icon={Search01Icon} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("est annoncée avec un libellé", () => {
    render(<Icon icon={Search01Icon} label="Rechercher" />);
    expect(screen.getByRole("img", { name: "Rechercher" })).toBeInTheDocument();
  });

  it("respecte la taille demandée", () => {
    const { container } = render(<Icon icon={Search01Icon} size={16} />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveAttribute("height", "16");
  });
});
