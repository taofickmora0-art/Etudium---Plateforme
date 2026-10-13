// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CourseIcon } from "@hugeicons/core-free-icons";
import { Groupe } from "@/components/ui/Groupe";
import { IconTile } from "@/components/ui/IconTile";

describe("Groupe", () => {
  it("une section nommée par son titre, avec son étiquette et son lien", () => {
    render(
      <Groupe titre="Continuer l’apprentissage" etiquette="2 éléments" lien={{ href: "/mes-formations", libelle: "Mes formations" }}>
        <p>Contenu</p>
      </Groupe>,
    );
    const region = screen.getByRole("region", { name: "Continuer l’apprentissage" });
    expect(within(region).getByRole("heading", { level: 2, name: "Continuer l’apprentissage" })).toBeInTheDocument();
    expect(within(region).getByText("2 éléments")).toBeInTheDocument();
    expect(within(region).getByRole("link", { name: "Mes formations" })).toHaveAttribute("href", "/mes-formations");
    expect(within(region).getByText("Contenu")).toBeInTheDocument();
  });

  it("sans étiquette ni lien", () => {
    render(<Groupe titre="Recommandé pour vous">{null}</Groupe>);
    const region = screen.getByRole("region", { name: "Recommandé pour vous" });
    expect(within(region).queryByRole("link")).toBeNull();
  });
});

describe("IconTile", () => {
  it("le ton « information » est bleu (tuile « Formations en cours »)", () => {
    const { container } = render(<IconTile icon={CourseIcon} tone="information" />);
    expect(container.firstElementChild).toHaveClass("bg-bleu-pale", "text-bleu");
  });
});
