// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";

describe("Mise en page des écrans de compte", () => {
  it("les écrans de compte ont un retour et un panneau", () => {
    render(
      <AuthLayout aside="connexion" back={{ href: "/", label: "Retour au site" }}>
        <AuthHeading title="Content de vous revoir">Connectez-vous pour reprendre votre apprentissage.</AuthHeading>
      </AuthLayout>,
    );
    expect(screen.getByRole("link", { name: "Étudium, accueil" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Retour au site" })).toHaveAttribute("href", "/");
    expect(within(screen.getByRole("main")).getByRole("heading", { level: 1, name: "Content de vous revoir" })).toBeInTheDocument();
    expect(within(screen.getByRole("complementary")).getByText("Les compétences qui comptent, pendant vos études et après.")).toBeInTheDocument();
  });

  it("le panneau de l'inscription liste ce qu'apporte le compte", () => {
    render(
      <AuthLayout aside="inscription" back={{ href: "/", label: "Retour au site" }}>
        <p>Formulaire</p>
      </AuthLayout>,
    );
    expect(within(screen.getByRole("complementary")).getAllByRole("listitem")).toHaveLength(3);
  });

  it("le panneau du compte rassure sur la progression", () => {
    render(
      <AuthLayout aside="compte" back={{ href: "/connexion", label: "Retour à la connexion" }}>
        <p>Formulaire</p>
      </AuthLayout>,
    );
    expect(screen.getByText("Votre progression est enregistrée.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retour à la connexion" })).toHaveAttribute("href", "/connexion");
  });
});
