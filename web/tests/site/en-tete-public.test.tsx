// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

let chemin = "/formations";
vi.mock("next/navigation", () => ({ usePathname: () => chemin }));

const { EnTetePublic } = await import("@/components/site/EnTetePublic");
const { PiedDePagePublic } = await import("@/components/site/PiedDePagePublic");

const liens = (conteneur: HTMLElement) => within(conteneur).getAllByRole("link").map((l) => [l.textContent, l.getAttribute("href")]);

describe("En-tête public (NdLanding §2)", () => {
  it("les cinq liens du site, dans l'ordre, avec des adresses qui marchent depuis toutes les pages", () => {
    render(<EnTetePublic />);
    expect(liens(screen.getByRole("navigation", { name: "Site Étudium" }))).toEqual([
      ["Parcours", "/#parcours"],
      ["Formations", "/formations"],
      ["Tarifs", "/#formules"],
      ["Communauté", "/#communaute"],
      ["Vérifier un certificat", "/verifier"],
    ]);
  });

  it("le bouton principal dit « Créer mon compte gratuit » (spec §9)", () => {
    render(<EnTetePublic />);
    expect(screen.getByRole("link", { name: "Créer mon compte gratuit" })).toHaveAttribute("href", "/inscription");
    expect(screen.getByRole("link", { name: "Se connecter" })).toHaveAttribute("href", "/connexion");
    expect(screen.queryByRole("link", { name: "Créer un compte gratuit" })).toBeNull();
  });

  it("au téléphone, le bouton Menu déplie les liens et l'inscription, puis se referme après un choix", async () => {
    const user = userEvent.setup();
    render(<EnTetePublic />);
    const bouton = screen.getByRole("button", { name: "Menu" });
    expect(bouton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Menu du site" })).toBeNull();

    await user.click(bouton);
    expect(bouton).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Menu du site" });
    expect(bouton).toHaveAttribute("aria-controls", menu.id);
    expect(liens(menu)).toEqual([
      ["Parcours", "/#parcours"],
      ["Formations", "/formations"],
      ["Tarifs", "/#formules"],
      ["Communauté", "/#communaute"],
      ["Vérifier un certificat", "/verifier"],
      ["Créer mon compte gratuit", "/inscription"],
    ]);

    await user.click(within(menu).getByRole("link", { name: "Tarifs" }));
    expect(screen.queryByRole("navigation", { name: "Menu du site" })).toBeNull();
    expect(bouton).toHaveAttribute("aria-expanded", "false");
  });

  it("le menu se referme quand on change de page (l'en-tête reste monté dans le catalogue)", async () => {
    const user = userEvent.setup();
    chemin = "/formations";
    const { rerender } = render(<EnTetePublic />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("navigation", { name: "Menu du site" })).toBeInTheDocument();
    chemin = "/formations/maitriser-microsoft-excel";
    rerender(<EnTetePublic />);
    expect(screen.queryByRole("navigation", { name: "Menu du site" })).toBeNull();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    chemin = "/formations";
  });

  it("l'en-tête reste en haut de l'écran quand la page défile, sur le fond de la page (demande du 15 octobre)", () => {
    render(<EnTetePublic />);
    expect(screen.getByRole("banner")).toHaveClass("sticky", "top-0", "z-40", "bg-page");
  });

  it("au téléphone, le menu déplié défile seul s'il dépasse la hauteur de l'écran", async () => {
    const user = userEvent.setup();
    render(<EnTetePublic />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("navigation", { name: "Menu du site" })).toHaveClass("overflow-y-auto");
  });

  it("la touche Échap referme le menu", async () => {
    const user = userEvent.setup();
    render(<EnTetePublic />);
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("navigation", { name: "Menu du site" })).toBeNull();
  });

  it("la page en cours est marquée (Formations)", () => {
    render(<EnTetePublic />);
    expect(within(screen.getByRole("navigation", { name: "Site Étudium" })).getByRole("link", { name: "Formations" })).toHaveAttribute("aria-current", "page");
  });
});

describe("Pied de page public (NdLanding §16)", () => {
  it("trois colonnes : Plateforme, Ressources, Légal ; pas de Contact sans adresse e-mail", () => {
    render(<PiedDePagePublic />);
    expect(liens(screen.getByRole("navigation", { name: "Plateforme" }))).toEqual([
      ["Formations", "/formations"],
      ["Parcours", "/#parcours"],
      ["Tarifs", "/#formules"],
    ]);
    expect(liens(screen.getByRole("navigation", { name: "Ressources" }))).toEqual([
      ["Questions fréquentes", "/#faq"],
      ["Vérifier un certificat", "/verifier"],
      ["Communauté", "/#communaute"],
    ]);
    expect(liens(screen.getByRole("navigation", { name: "Légal" }))).toEqual([
      ["Conditions d’utilisation", "/conditions"],
      ["Confidentialité", "/confidentialite"],
    ]);
    expect(screen.queryByRole("link", { name: "Contact" })).toBeNull();
  });
});

describe("En-tête public, compte connecté (demande du 3 novembre 2026)", () => {
  it("un seul bouton « Accéder à l'espace membre » à la place de la connexion et de l'inscription", () => {
    document.cookie = "sb-abcd-auth-token=jeton; path=/";
    try {
      render(<EnTetePublic />);
      expect(screen.getAllByRole("link", { name: "Accéder à l’espace membre" })[0]).toHaveAttribute("href", "/accueil");
      // Sur téléphone, un libellé court pour tenir sur la ligne du logo (capture du 3 novembre 2026).
      expect(screen.getAllByRole("link", { name: "Accéder à l’espace membre" })[0]).toHaveTextContent("Espace membre");
      expect(screen.getByText("Espace membre")).toHaveClass("sm:hidden");
      expect(screen.queryByRole("link", { name: "Se connecter" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Créer mon compte gratuit" })).toBeNull();
    } finally {
      document.cookie = "sb-abcd-auth-token=; path=/; max-age=0";
    }
  });
});
