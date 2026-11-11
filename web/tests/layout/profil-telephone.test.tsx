// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Role } from "@/lib/auth/permissions";
import { DEMO_USER } from "@/lib/demo-user";

// La page « Profil » du téléphone (demande du 31 octobre 2026) : le compte seulement, comme le menu du rond de profil
// sur ordinateur. Tout le reste (parcours, exercices, certificats…) est dans le menu ≡.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/menu" }));
vi.mock("@/lib/auth/actions", () => ({ signOut: vi.fn() }));

const { MobileProfileMenu } = await import("@/components/layout/MobileProfileMenu");

const compte = (roles: Role[]) => ({ ...DEMO_USER, roles });
const liens = () => within(screen.getByRole("list", { name: "Mon compte" })).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")]);

describe("La page Profil du téléphone", () => {
  it("l'étudiant : son profil, son abonnement et la déconnexion ; pas de raccourcis", () => {
    render(<MobileProfileMenu user={compte(["etudiant"])} />);
    expect(liens()).toEqual([
      ["Mon profil", "/profil"],
      ["Mon abonnement", "/abonnement"],
    ]);
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
    for (const ancien of ["Mes parcours", "Exercices", "Certificats", "Formations gratuites", "Favoris", "Événements", "Messages", "Aide"]) {
      expect(screen.queryByRole("link", { name: ancien })).toBeNull();
    }
  });

  it("l'étudiant : sa série et ses points de la semaine (NdMobMenu, lot 6 B), vers son tableau de bord", () => {
    render(<MobileProfileMenu user={{ ...compte(["etudiant"]), serie: 8, points: 165 }} />);
    expect(screen.getByRole("link", { name: "Série d’apprentissage : 8 jours" })).toHaveAttribute("href", "/tableau-de-bord");
    expect(screen.getByRole("link", { name: "Points gagnés cette semaine : 165 points" })).toHaveAttribute("href", "/tableau-de-bord");
  });

  it("un admin : en plus, le changement d'espace (Espace étudiant, Back-office)", () => {
    render(<MobileProfileMenu user={compte(["etudiant", "admin"])} />);
    expect(liens()).toEqual([
      ["Mon profil", "/profil"],
      ["Mon abonnement", "/abonnement"],
      ["Espace étudiant", "/accueil"],
      ["Back-office", "/admin"],
    ]);
  });

  it("le formateur : son profil et la déconnexion ; pas d'abonnement ni de changement d'espace", () => {
    render(<MobileProfileMenu user={compte(["formateur"])} espace="formateur" />);
    expect(liens()).toEqual([["Mon profil", "/formateur/profil"]]);
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
    expect(screen.queryByText("Série d’apprentissage")).toBeNull();
    expect(screen.queryByText("Gagnés cette semaine")).toBeNull();
  });

  it("plusieurs rôles (0079) : chaque espace du compte, depuis l'espace étudiant comme depuis l'espace formateur", () => {
    const { unmount } = render(<MobileProfileMenu user={compte(["etudiant", "formateur", "admin"])} espace="formateur" />);
    expect(liens()).toEqual([
      ["Mon profil", "/formateur/profil"],
      ["Espace étudiant", "/accueil"],
      ["Espace formateur", "/formateur"],
      ["Back-office", "/admin"],
    ]);
    unmount();
    render(<MobileProfileMenu user={compte(["etudiant", "formateur"])} />);
    expect(liens()).toEqual([
      ["Mon profil", "/profil"],
      ["Mon abonnement", "/abonnement"],
      ["Espace étudiant", "/accueil"],
      ["Espace formateur", "/formateur"],
    ]);
  });
});
