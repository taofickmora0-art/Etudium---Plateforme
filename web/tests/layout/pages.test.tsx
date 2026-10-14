// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComingSoonView } from "@/components/layout/ComingSoon";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { DEMO_USER } from "@/lib/demo-user";
import { MENUS, NAV_BAS_PAR_ESPACE, NAV_MENU_TELEPHONE } from "@/lib/navigation";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), usePathname: () => "/menu" }));

describe("Pages de l'espace connecté", () => {
  it("chaque lien du menu mène à une page", () => {
    const hrefs = new Set([
      ...Object.values(MENUS).flatMap((m) => m.groupes.flatMap((g) => g.entrees)).map((e) => e.href),
      ...[...Object.values(NAV_BAS_PAR_ESPACE).flat(), ...NAV_MENU_TELEPHONE].map((e) => e.href),
      // en-tête et menu du profil
      "/recherche",
      "/notifications",
      "/profil",
      "/abonnement",
      "/formateur",
      "/admin",
    ]);
    // Le catalogue (« Toutes les formations ») vit dans le groupe (catalogue), ouvert aussi aux visiteurs.
    const existe = (href: string) => ["(app)", "(app)/(etudiant)", "(catalogue)"].some((groupe) => existsSync(join(process.cwd(), "src/app", groupe, href, "page.tsx")));
    const manquantes = [...hrefs].filter((href) => !existe(href));
    expect(manquantes).toEqual([]);
  });

  it("la page à venir dit quand elle arrive", () => {
    render(<ComingSoonView page="messages" />);
    expect(screen.getByRole("heading", { level: 1, name: "Messages" })).toBeInTheDocument();
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
