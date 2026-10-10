// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { DEMO_USER } from "@/lib/demo-user";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/accueil" }));

async function ouvrirDeconnexion() {
  const user = userEvent.setup();
  render(<HeaderActions user={DEMO_USER} />);
  await user.click(screen.getByRole("button", { name: "Mon profil" }));
  await user.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
  return user;
}

describe("Actions de l'en-tête", () => {
  beforeEach(() => push.mockClear());

  it("la cloche ouvre un panneau vide", async () => {
    const user = userEvent.setup();
    render(<HeaderActions user={DEMO_USER} />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Vous êtes à jour")).toBeVisible();
  });

  it("se déconnecter demande confirmation", async () => {
    const user = await ouvrirDeconnexion();
    const fenetre = screen.getByRole("dialog", { name: "Se déconnecter ?" });
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(fenetre).not.toBeInTheDocument();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("Échap ferme la confirmation et rend le focus", async () => {
    const user = await ouvrirDeconnexion();
    expect(screen.getByRole("dialog", { name: "Se déconnecter ?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon profil" })).toHaveFocus();
  });
});
