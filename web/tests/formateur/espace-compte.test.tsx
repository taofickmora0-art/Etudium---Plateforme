// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import { DEMO_USER } from "@/lib/demo-user";

// Restructuration R1 : le formateur n'a plus l'espace étudiant. Son espace a son profil, ses notifications, sa page
// « Profil » du téléphone ; l'en-tête n'a ni série, ni points, ni loupe, et le logo mène à son tableau de bord.
let chemin = "/formateur";
vi.mock("next/navigation", () => ({ usePathname: () => chemin, useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));
vi.mock("@/lib/messages/actions", () => ({ compterMessagesNonLus: async () => 0 }));
vi.mock("@/lib/sessions/nouvelles", () => ({ compterNouvellesSessions: async () => 0, marquerEvenementsVus: async () => undefined }));

const { AppHeader, HeaderAccount } = await import("@/components/layout/AppHeader");
const { HeaderActions } = await import("@/components/layout/HeaderActions");
const { MobileProfileMenu } = await import("@/components/layout/MobileProfileMenu");
const { ProfileMenu } = await import("@/components/ui/ProfileMenu");

const compte = (roles: Role[]) => ({ ...DEMO_USER, roles });
// Un formateur sans « Étudiant » (0079) : il n'a pas l'espace étudiant.
const FORMATEUR = compte(["formateur"]);
const lire = (fichier: string) => readFileSync(join(process.cwd(), fichier), "utf8");

describe("L'en-tête de l'espace formateur", () => {
  it("le logo mène au tableau de bord ; pas de loupe ni de « Rechercher »", () => {
    render(<AppHeader espace="formateur" />);
    expect(screen.getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/formateur");
    expect(screen.queryByRole("link", { name: "Rechercher" })).toBeNull();
  });

  it("l'espace étudiant garde son en-tête", () => {
    chemin = "/accueil";
    render(<AppHeader espace="etudiant" />);
    expect(screen.getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/accueil");
    expect(screen.getAllByRole("link", { name: "Rechercher" }).length).toBeGreaterThan(0);
    chemin = "/formateur";
  });

  it("ni série ni points pour un formateur", () => {
    const { unmount } = render(<HeaderAccount user={FORMATEUR} />);
    expect(screen.queryByRole("link", { name: /^Série d’apprentissage/ })).toBeNull();
    expect(screen.queryByRole("link", { name: /^Points/ })).toBeNull();
    unmount();
    render(<HeaderAccount user={compte(["etudiant"])} />);
    expect(screen.getByRole("link", { name: /^Série d’apprentissage/ })).toBeInTheDocument();
  });

  it("la cloche mène à ses notifications", async () => {
    const user = userEvent.setup();
    render(<HeaderActions user={FORMATEUR} />);
    await user.click(screen.getByRole("button", { name: "Notifications" }));
    expect(within(screen.getByRole("dialog", { name: "Notifications" })).getByRole("link", { name: "Voir toutes les notifications" })).toHaveAttribute(
      "href",
      "/formateur/notifications",
    );
  });

  it("le menu du profil : son profil, ni « Espace étudiant » ni « Mon abonnement »", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu user={{ initials: "MA", name: "Mireille Adjovi", email: "m@exemple.com" }} roles={FORMATEUR.roles} currentSpace="formateur" onSignOut={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.getByRole("menuitem", { name: "Mon profil" })).toHaveAttribute("href", "/formateur/profil");
    expect(screen.queryByRole("menuitem", { name: /Espace étudiant/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: /Mon abonnement/ })).toBeNull();
  });

  it("l'équipe garde l'espace étudiant et son abonnement", async () => {
    const user = userEvent.setup();
    render(<ProfileMenu user={{ initials: "AD", name: "Awa Diallo", email: "a@exemple.com" }} roles={["etudiant", "admin"]} currentSpace="admin" onSignOut={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Mon profil" }));
    expect(screen.getByRole("menuitem", { name: /Espace étudiant/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Back-office/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Mon profil" })).toHaveAttribute("href", "/profil");
  });
});

describe("La page « Profil » du téléphone, côté formateur", () => {
  it("son profil seulement (le reste est dans le menu ≡, demande du 31 octobre), sans série ni points ni changement d'espace", () => {
    render(<MobileProfileMenu user={FORMATEUR} espace="formateur" />);
    const compte = within(screen.getByRole("list", { name: "Mon compte" }));
    expect(compte.getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")])).toEqual([["Mon profil", "/formateur/profil"]]);
    expect(screen.queryByRole("link", { name: /^Série d’apprentissage/ })).toBeNull();
    expect(screen.getByText(/Formateur·rice/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Espace formateur|Back-office/ })).toBeNull();
  });
});

describe("Les pages de compte de l'espace formateur", () => {
  it("profil, notifications et menu : réservées au formateur, mêmes contenus que l'étudiant", () => {
    const profil = lire("src/app/(app)/formateur/profil/page.tsx");
    expect(profil).toContain('requireSpace("formateur")');
    expect(profil).toContain("<ProfileTabs");
    const notifications = lire("src/app/(app)/formateur/notifications/page.tsx");
    expect(notifications).toContain('requireSpace("formateur")');
    expect(notifications).toContain("<ContenuNotifications");
    const menu = lire("src/app/(app)/formateur/menu/page.tsx");
    expect(menu).toContain('requireSpace("formateur")');
    expect(menu).toContain('<MobileProfileMenu user={user} espace="formateur"');
  });
});
