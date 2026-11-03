// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog } from "@/components/ui/Dialog";

// Sur téléphone, la fenêtre est une feuille collée en bas ; le clavier passait par-dessus (« Nouveau message » de la
// messagerie, capture du 3 novembre 2026). Elle remonte au-dessus du clavier, et sa hauteur suit la partie visible.

type Ecouteur = () => void;
const ecouteurs: Ecouteur[] = [];
const vue = { height: 800, offsetTop: 0, addEventListener: (_: string, f: Ecouteur) => ecouteurs.push(f), removeEventListener: () => {} };

function telephone(largeur: number) {
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(window, "visualViewport", { configurable: true, value: vue });
  window.matchMedia = ((requete: string) => ({
    matches: requete.includes("max-width") && largeur < 640,
    media: requete,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
}

function ouvrirClavier(hauteurVisible: number) {
  vue.height = hauteurVisible;
  act(() => ecouteurs.forEach((f) => f()));
}

afterEach(() => {
  ecouteurs.length = 0;
  vue.height = 800;
});

describe("La fenêtre et le clavier du téléphone", () => {
  it("le clavier ouvert : la feuille remonte au-dessus et tient dans la partie visible", () => {
    telephone(390);
    render(
      <Dialog open onOpenChange={() => {}} title="Nouveau message">
        <input aria-label="Rechercher un formateur" />
      </Dialog>,
    );
    const fenetre = screen.getByRole("dialog", { name: "Nouveau message" });
    expect(fenetre.style.bottom).toBe("");
    ouvrirClavier(460);
    expect(fenetre.style.bottom).toBe("340px");
    expect(fenetre.style.maxHeight).toBe("444px");
    ouvrirClavier(800);
    expect(fenetre.style.bottom).toBe("");
    expect(fenetre.style.maxHeight).toBe("");
  });

  it("sur ordinateur, rien ne change", () => {
    telephone(1280);
    render(<Dialog open onOpenChange={() => {}} title="Nouveau message" />);
    ouvrirClavier(460);
    const fenetre = screen.getByRole("dialog", { name: "Nouveau message" });
    expect(fenetre.style.bottom).toBe("");
    expect(fenetre.style.maxHeight).toBe("");
  });
});
