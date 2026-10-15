// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

let chemin = "/accueil";
vi.mock("next/navigation", () => ({ usePathname: () => chemin, useRouter: () => ({ push: vi.fn() }) }));

const { SidebarNavLinks } = await import("@/components/layout/SidebarNav");
const { BottomNavLinks } = await import("@/components/layout/MobileNav");
const { BoutonAjouterFormation } = await import("@/components/layout/BoutonAjouterFormation");
const { ComingSoonView } = await import("@/components/layout/ComingSoon");

const liens = (nav: HTMLElement) => within(nav).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")]);

describe("Un menu par espace (back-office, espace formateur, espace étudiant)", () => {
  it("back-office : tableau de bord, contenus, plateforme ; l'entrée de la page courante est marquée", () => {
    render(<SidebarNavLinks pathname="/admin/parcours" />);
    const nav = screen.getByRole("navigation", { name: "Navigation du back-office" });
    expect(liens(nav)).toEqual([
      ["Tableau de bord", "/admin"],
      ["Parcours", "/admin/parcours"],
      ["Formateurs", "/admin/formateurs"],
      ["Formations", "/admin/formations"],
      ["Corrections", "/admin/corrections"],
      ["Avis", "/admin/avis"],
      ["Sessions live", "/admin/sessions"],
      ["Utilisateurs", "/admin/utilisateurs"],
      ["Messages", "/admin/messages"],
      ["Annonces", "/admin/annonces"],
      ["Abonnements et paiements", "/admin/paiements"],
      ["Communauté", "/admin/communaute"],
      ["Modération", "/admin/moderation"],
    ]);
    expect(within(nav).getByRole("group", { name: "Contenus" })).toBeInTheDocument();
    expect(within(nav).getByRole("group", { name: "Plateforme" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Parcours" })).toHaveAttribute("aria-current", "page");
    // Le tableau de bord n'est marqué que sur sa propre page, pas sur toutes celles du back-office.
    expect(within(nav).getByRole("link", { name: "Tableau de bord" })).not.toHaveAttribute("aria-current");
  });

  it("le tableau de bord est marqué sur sa page", () => {
    render(<SidebarNavLinks pathname="/admin" />);
    expect(screen.getByRole("link", { name: "Tableau de bord" })).toHaveAttribute("aria-current", "page");
  });

  it("espace formateur : son propre menu (noms et ordre du design NdFormateur), sans les entrées de l'étudiant", () => {
    render(<SidebarNavLinks pathname="/formateur/etudiants/123" />);
    const nav = screen.getByRole("navigation", { name: "Navigation de l’espace formateur" });
    expect(liens(nav)).toEqual([
      ["Tableau de bord", "/formateur"],
      ["Mes formations", "/formateur/formations"],
      ["Corrections", "/formateur/corrections"],
      ["Sessions live", "/formateur/sessions"],
      ["Étudiants", "/formateur/etudiants"],
      ["Messages", "/formateur/messages"],
    ]);
    expect(within(nav).getByRole("group", { name: "Enseignement" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Étudiants" })).toHaveAttribute("aria-current", "page");
  });

  it("espace étudiant : un seul onglet Formations après Accueil, Événements après Messages", () => {
    render(<SidebarNavLinks pathname="/mes-formations" />);
    const nav = screen.getByRole("navigation", { name: "Navigation principale" });
    const groupe = within(nav).getByRole("group", { name: "Mon espace" });
    const principaux = within(nav)
      .getAllByRole("link")
      .filter((l) => !groupe.contains(l))
      .map((l) => [l.textContent, l.getAttribute("href")]);
    expect(principaux).toEqual([
      ["Accueil", "/accueil"],
      ["Formations", "/formations"],
      ["Messages", "/messages"],
      ["Événements", "/evenements"],
    ]);
    expect(within(groupe).getAllByRole("link").map((l) => l.textContent)).toEqual([
      "Exercices",
      "Mes parcours",
      "Certificats",
      "Formations gratuites",
      "Favoris",
      "Mon abonnement",
      "Aide",
    ]);
    // « Mes formations » (la liste complète) reste marquée sous l'onglet Formations.
    expect(within(nav).getByRole("link", { name: "Formations" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).queryByRole("link", { name: "Tableau de bord" })).toBeNull();
  });

  it("adresse encore inconnue (rendu préalable) : pas le menu d'un autre espace", () => {
    const { unmount } = render(<SidebarNavLinks pathname={null} />);
    expect(screen.queryAllByRole("link")).toEqual([]);
    unmount();
    // Le catalogue connecté sait qu'il est dans l'espace étudiant.
    render(<SidebarNavLinks pathname={null} espace="etudiant" />);
    expect(screen.getByRole("link", { name: "Formations" })).toBeInTheDocument();
  });

  it("la barre du bas du téléphone suit l'espace", () => {
    const { unmount } = render(<BottomNavLinks pathname="/admin/avis" />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Tableau de bord", "Formations", "Avis", "Utilisateurs", "Profil"]);
    expect(screen.getByRole("link", { name: "Avis" })).toHaveAttribute("aria-current", "page");
    unmount();
    const formateur = render(<BottomNavLinks pathname="/formateur" />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Tableau de bord", "Formations", "Étudiants", "Sessions live", "Profil"]);
    formateur.unmount();
    const etudiant = render(<BottomNavLinks pathname="/accueil" />);
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Accueil", "Formations", "Événements", "Certificats", "Profil"]);
    expect(screen.getByRole("link", { name: "Formations" })).toHaveAttribute("href", "/formations");
    etudiant.unmount();
    const suivies = render(<BottomNavLinks pathname="/mes-formations" />);
    expect(screen.getByRole("link", { name: "Formations" })).toHaveAttribute("aria-current", "page");
    suivies.unmount();
    // La page d'une publication de la communauté garde l'Accueil marqué (spec du nouvel Accueil, §4).
    render(<BottomNavLinks pathname="/communaute/publications/abc" />);
    expect(screen.getByRole("link", { name: "Accueil" })).toHaveAttribute("aria-current", "page");
  });

  it("« Ajouter une formation » : le formulaire au back-office, les formations du formateur dans son espace, le catalogue ailleurs", () => {
    chemin = "/admin/avis";
    const { unmount } = render(<BoutonAjouterFormation />);
    expect(screen.getByRole("link", { name: "Ajouter une formation" })).toHaveAttribute("href", "/admin/formations/nouvelle");
    unmount();
    chemin = "/formateur";
    const formateur = render(<BoutonAjouterFormation />);
    expect(screen.getByRole("link", { name: "Ajouter une formation" })).toHaveAttribute("href", "/formateur/formations/nouvelle");
    formateur.unmount();
    chemin = "/accueil";
    render(<BoutonAjouterFormation />);
    expect(screen.getByRole("link", { name: "Ajouter une formation" })).toHaveAttribute("href", "/formations");
  });

  it("une page à venir du back-office ou de l'espace formateur ramène à son tableau de bord", () => {
    const { unmount } = render(<ComingSoonView page="admin/paiements" />);
    expect(screen.getByRole("heading", { level: 1, name: "Abonnements et paiements" })).toBeInTheDocument();
    expect(screen.getByText(/au lot 2/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour au tableau de bord" })).toHaveAttribute("href", "/admin");
    unmount();
    // L'espace formateur n'a plus de page à venir depuis la messagerie (lot 5, étape A).
  });
});
