// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("la photo remplace les initiales", () => {
    const { container, unmount } = render(<Avatar initials="AK" src="https://projet.supabase.co/a.jpg" name="Aïcha Kpadé" size={64} />);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://projet.supabase.co/a.jpg");
    expect(screen.getByRole("img", { name: "Aïcha Kpadé" })).toBeInTheDocument();
    expect(screen.queryByText("AK")).not.toBeInTheDocument();
    unmount();
    render(<Avatar initials="AK" />);
    expect(screen.getByText("AK")).toBeInTheDocument();
  });

  it("une photo qui ne se charge pas laisse place aux initiales", () => {
    const { container } = render(<Avatar initials="AK" src="https://projet.supabase.co/disparue.jpg" />);
    fireEvent.error(container.querySelector("img")!);
    expect(screen.getByText("AK")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("une photo déjà en échec avant le chargement de la page laisse place aux initiales", () => {
    // Le serveur envoie l'image dans la page : son erreur peut survenir avant que React ne s'y branche (pas d'événement rejoué).
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    const { container } = render(<Avatar initials="AK" src="https://projet.supabase.co/disparue.jpg" />);
    expect(screen.getByText("AK")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("une photo déjà chargée avant le chargement de la page reste affichée", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(512);
    const { container } = render(<Avatar initials="AK" src="https://projet.supabase.co/a.jpg" />);
    expect(container.querySelector("img")).not.toBeNull();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
