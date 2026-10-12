// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComingSoonView } from "@/components/layout/ComingSoon";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { DEMO_USER } from "@/lib/demo-user";
import { NAV_BAS, NAV_MENU_TELEPHONE, NAV_MON_ESPACE, NAV_PRINCIPALE } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/menu" }));

describe("Pages de l'espace connecté", () => {
  it("chaque lien du menu mène à une page", () => {
    const hrefs = new Set([
      ...[NAV_PRINCIPALE, NAV_MON_ESPACE, NAV_BAS, NAV_MENU_TELEPHONE].flat().map((e) => e.href),
      // en-tête et menu du profil
      "/recherche",
      "/notifications",
      "/profil",
      "/abonnement",
      "/formateur",
      "/admin",
    ]);
    const manquantes = [...hrefs].filter((href) => !existsSync(join(process.cwd(), "src/app/(app)", href, "page.tsx")));
    expect(manquantes).toEqual([]);
  });

  it("la page à venir dit quand elle arrive", () => {
    render(<ComingSoonView page="evenements" />);
    expect(screen.getByRole("heading", { level: 1, name: "Événements" })).toBeInTheDocument();
    expect(screen.getByText(/au lot 5/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à l’accueil" })).toHaveAttribute("href", "/accueil");
  });

  it("la page Profil du téléphone coupe un nom trop long", () => {
    const nomLong = "Marie-Christine-Antoinette de La Rochefoucauld-Montmorency";
    render(<MobileProfileMenu user={{ ...DEMO_USER, nom: nomLong }} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveClass("truncate");
    expect(screen.getByRole("button", { name: "Se déconnecter" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mon profil" })).toHaveAttribute("href", "/profil");
  });
});
