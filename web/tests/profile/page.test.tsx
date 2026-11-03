// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { ToastProvider } from "@/components/ui/Toast";
import { routeFor } from "@/lib/auth/routing";
import { DEMO_JEU, DEMO_PROFILE } from "@/lib/demo-user";
import { ongletProfil } from "@/lib/profile/onglets";
import { updatePreferences } from "@/lib/profile/actions";

vi.mock("@/lib/profile/actions", () => ({
  updateProfile: vi.fn(),
  updatePhoto: vi.fn(),
  updatePreferences: vi.fn(),
  choisirObjectif: vi.fn(),
  changePassword: vi.fn(),
  deleteAccount: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/profil" }));

describe("Page du profil", () => {
  it("le profil est réservé aux comptes connectés", () => {
    expect(routeFor({ pathname: "/profil", signedIn: false, hadSession: false })).toEqual({ redirect: "/connexion?next=%2Fprofil" });
  });

  it("?onglet=notifications ouvre l'onglet Notifications ; une autre valeur ouvre Informations", () => {
    expect(ongletProfil("notifications")).toBe("notifications");
    expect(ongletProfil("securite")).toBe("securite");
    expect(ongletProfil("autre")).toBe("informations");
    expect(ongletProfil(undefined)).toBe("informations");
    render(
      <ToastProvider>
        <ProfileTabs profile={DEMO_PROFILE} ongletInitial="notifications" />
      </ToastProvider>,
    );
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveAttribute("aria-selected", "true");
  });

  it("l'étudiant : la carte « Gamification » (Informations) et l'objectif de la semaine (Notifications) ; le formateur, ni l'un ni l'autre", () => {
    const { unmount } = render(
      <ToastProvider>
        <ProfileTabs profile={DEMO_PROFILE} jeu={DEMO_JEU} />
      </ToastProvider>,
    );
    expect(screen.getByRole("region", { name: "Gamification" })).toBeInTheDocument();
    // L'onglet Notifications reste monté, caché : on y cherche aussi les éléments cachés.
    expect(screen.getByRole("radio", { name: "5 jours", hidden: true })).toBeChecked();
    unmount();
    render(
      <ToastProvider>
        <ProfileTabs profile={DEMO_PROFILE} />
      </ToastProvider>,
    );
    expect(screen.queryByRole("region", { name: "Gamification" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "5 jours", hidden: true })).toBeNull();
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
