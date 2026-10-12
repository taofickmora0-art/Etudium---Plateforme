// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { ToastProvider } from "@/components/ui/Toast";
import { routeFor } from "@/lib/auth/routing";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { PAGES_A_VENIR } from "@/lib/pages-a-venir";
import { updatePreferences } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({
  updateProfile: vi.fn(),
  updatePhoto: vi.fn(),
  updatePreferences: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/profil" }));

describe("Page du profil", () => {
  it("le profil est réservé aux comptes connectés", () => {
    expect(routeFor({ pathname: "/profil", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fprofil" });
  });

  it("le profil n'est plus une page à venir", () => {
    expect(PAGES_A_VENIR).not.toHaveProperty("profil");
  });

  it("les trois sections du profil", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ProfileTabs profile={DEMO_PROFILE} />
      </ToastProvider>,
    );
    const onglets = screen.getAllByRole("tab");
    expect(onglets.map((o) => o.textContent)).toEqual(["Informations", "Notifications", "Sécurité"]);
    expect(screen.getByRole("tab", { name: "Informations" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Sécurité" }));
    expect(screen.getByRole("heading", { name: "Mot de passe" })).toBeInTheDocument();
  });

  it("changer d'onglet ne fait pas perdre les choix enregistrés", async () => {
    vi.mocked(updatePreferences).mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ProfileTabs profile={DEMO_PROFILE} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("tab", { name: "Notifications" }));
    await user.click(screen.getByRole("switch", { name: "Recommandations" }));
    await user.click(screen.getByRole("tab", { name: "Sécurité" }));
    await user.click(screen.getByRole("tab", { name: "Notifications" }));
    expect(screen.getByRole("switch", { name: "Recommandations" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("switch", { name: "Annonces" }));
    expect(vi.mocked(updatePreferences).mock.calls.at(-1)?.[0]).toMatchObject({ recommandations: true, annonces: true });
  });
});
