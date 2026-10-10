// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { Pagination } from "@/components/ui/Pagination";
import { ToastView } from "@/components/ui/Toast";

// Sur un écran tactile, les petites commandes gardent leur dessin mais reçoivent une zone de toucher de 44 px
// (utilitaire `cible-tactile` de globals.css, actif seulement avec un pointeur grossier).
describe("Cibles tactiles", () => {
  it("les boutons, petits boutons et pages ont une zone de 44 px", () => {
    render(
      <>
        <Button size="sm">Appliquer</Button>
        <IconButton icon={Cancel01Icon} label="Fermer le panneau" size="sm" />
        <Pagination page={1} pageCount={2} onPageChange={() => {}} />
        <Checkbox label="Se souvenir de moi sur cet appareil" />
        <ToastView tone="erreur" title="Envoi impossible" action={{ label: "Réessayer", onClick: () => {} }} onDismiss={() => {}} />
      </>,
    );
    for (const name of ["Appliquer", "Fermer le panneau", "Page 2", "Page suivante", "Réessayer", "Fermer la notification"]) {
      expect(screen.getByRole("button", { name })).toHaveClass("cible-tactile");
    }
    expect(screen.getByText("Se souvenir de moi sur cet appareil").closest("label")).toHaveClass("cible-tactile");
  });

  it("la croix d'une fenêtre a une zone de 44 px", () => {
    render(<Dialog open onOpenChange={() => {}} title="Se déconnecter ?" />);
    expect(screen.getByRole("button", { name: "Fermer" })).toHaveClass("cible-tactile");
  });
});
