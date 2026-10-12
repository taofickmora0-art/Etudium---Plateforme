// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionExpiredDialog } from "@/components/auth/SessionExpiredDialog";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

describe("Session expirée", () => {
  it("la fenêtre bloque jusqu'à « Se reconnecter »", async () => {
    const user = userEvent.setup();
    render(<SessionExpiredDialog />);
    expect(screen.getByRole("dialog", { name: "Votre session a expiré" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Fermer" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Se reconnecter" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/connexion");
  });

  it("« Se reconnecter » garde la page demandée", async () => {
    const user = userEvent.setup();
    replace.mockClear();
    render(<SessionExpiredDialog next="/certificats" />);
    await user.click(screen.getByRole("button", { name: "Se reconnecter" }));
    expect(replace).toHaveBeenCalledWith("/connexion?next=%2Fcertificats");
  });
});
