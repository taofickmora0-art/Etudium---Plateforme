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
  it("l'étudiant : son profil, son abonnement et la déconnexion ; ni raccourcis ni série ni points", () => {
    render(<MobileProfileMenu user={compte(["etudiant"])} />);
    expect(liens()).toEqual([
      ["Mon profil", "/profil"],
      ["Mon abonnement", "/abonnement"],
    ]);
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
    for (const ancien of ["Mes parcours", "Exercices", "Certificats", "Formations gratuites", "Favoris", "Événements", "Messages", "Aide"]) {
      expect(screen.queryByRole("link", { name: ancien })).toBeNull();
    }
    expect(screen.queryByText("Série d’apprentissage")).toBeNull();
    expect(screen.queryByText("Gagnés cette semaine")).toBeNull();
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
    render(<MobileProfileMenu user={compte(["etudiant", "formateur"])} espace="formateur" />);
    expect(liens()).toEqual([["Mon profil", "/formateur/profil"]]);
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
  });
});
