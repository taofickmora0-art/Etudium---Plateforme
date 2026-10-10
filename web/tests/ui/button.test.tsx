// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

describe("Button", () => {
  it("un bouton en chargement est désactivé et annoncé", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Paiement en cours…
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Paiement en cours/ });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asChild rend un lien stylé", () => {
    render(
      <Button asChild>
        <a href="/x">Aller</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Aller" })).toHaveAttribute("href", "/x");
  });
});

describe("IconButton", () => {
  it("expose son libellé comme nom accessible", () => {
    render(<IconButton icon={Cancel01Icon} label="Fermer" />);
    expect(screen.getByRole("button", { name: "Fermer" })).toBeInTheDocument();
  });
});
