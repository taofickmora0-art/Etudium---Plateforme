// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
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
});
