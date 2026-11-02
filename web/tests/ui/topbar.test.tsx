// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CounterPill,
  LogoButton,
  NotificationButton,
  ProfileButton,
  SearchButton,
} from "@/components/ui/TopBarButtons";

describe("TopBarButtons", () => {
  it("le logo ramène à l'accueil", () => {
    render(<LogoButton />);
    expect(screen.getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/");
  });

  it("les compteurs annoncent ce qu'ils comptent", () => {
    render(<CounterPill icon="points" value={165} label="Points" />);
    expect(screen.getByText("Points")).toHaveClass("sr-only");
    expect(screen.getByText("165")).toBeVisible();
  });

  it("une pastille avec une adresse est un lien, qui dit ce qu'il compte et combien", () => {
    render(<CounterPill icon="serie" value={8} label="Série d’apprentissage" href="/tableau-de-bord" nomAccessible="Série d’apprentissage : 8 jours" />);
    expect(screen.getByRole("link", { name: "Série d’apprentissage : 8 jours" })).toHaveAttribute("href", "/tableau-de-bord");
  });

  it("les boutons sans texte ont un nom", () => {
    render(
      <>
        <SearchButton />
        <NotificationButton />
        <ProfileButton />
      </>,
    );
    expect(screen.getByRole("button", { name: "Rechercher" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mon profil" })).toBeInTheDocument();
  });
});
