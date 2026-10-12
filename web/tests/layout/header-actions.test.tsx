// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HeaderActions } from "@/components/layout/HeaderActions";
import { signOut } from "@/lib/auth/actions";
import { loadFullPage } from "@/lib/full-page";
import { DEMO_USER } from "@/lib/demo-user";

vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/accueil",
}));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/full-page", () => ({ loadFullPage: vi.fn() }));

async function ouvrirDeconnexion() {
  const user = userEvent.setup();
  render(<HeaderActions user={DEMO_USER} />);
  await user.click(screen.getByRole("button", { name: "Mon profil" }));
  await user.click(screen.getByRole("menuitem", { name: "Se déconnecter" }));
  return user;
}

describe("Actions de l'en-tête", () => {
  beforeEach(() => {
    vi.mocked(signOut).mockReset();
    vi.mocked(loadFullPage).mockReset();
  });

  it("la photo de profil s'affiche dans le rond de l'en-tête", () => {
    render(<HeaderActions user={{ ...DEMO_USER, photoUrl: "https://projet.supabase.co/a.jpg" }} />);
    expect(screen.getByRole("button", { name: "Mon profil" }).querySelector("img")).toHaveAttribute("src", "https://projet.supabase.co/a.jpg");
  });

  it("la cloche ouvre un panneau vide", async () => {
    const user = userEvent.setup();
    render(<HeaderActions user={DEMO_USER} />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("Vous êtes à jour")).toBeVisible();
  });

  it("se déconnecter demande confirmation, puis ferme la session", async () => {
    vi.mocked(signOut).mockResolvedValue(undefined);
    const user = await ouvrirDeconnexion();
    const fenetre = screen.getByRole("dialog", { name: "Se déconnecter ?" });
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(signOut).toHaveBeenCalledOnce();
    expect(fenetre).not.toBeInTheDocument();
  });

  it("après la déconnexion, la page de connexion est entièrement rechargée (rien du compte ne reste en mémoire)", async () => {
    vi.mocked(signOut).mockResolvedValue(undefined);
    const user = await ouvrirDeconnexion();
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(loadFullPage).toHaveBeenCalledWith("/connexion");
  });

  it("si la base ne répond pas, la fenêtre reste ouverte et le dit", async () => {
    vi.mocked(signOut).mockRejectedValue(new Error("réseau"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const user = await ouvrirDeconnexion();
    await user.click(screen.getByRole("button", { name: "Se déconnecter" }));
    expect(screen.getByRole("dialog", { name: "Se déconnecter ?" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("L’action n’a pas abouti.");
    expect(loadFullPage).not.toHaveBeenCalled();
  });

  it("Échap ferme la confirmation et rend le focus", async () => {
    const user = await ouvrirDeconnexion();
    expect(screen.getByRole("dialog", { name: "Se déconnecter ?" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon profil" })).toHaveFocus();
  });
});
