// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
