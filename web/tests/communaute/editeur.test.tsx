// @vitest-environment jsdom
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { EditeurTexte } from "@/components/communaute/EditeurTexte";

// L'éditeur visuel (spec mise en forme et vidéo, §1). jsdom ne sait pas simuler la sélection d'un champ éditable : on
// sélectionne tout au clavier (Ctrl+A, géré par l'éditeur lui-même), puis on applique la mise en forme par la barre.

beforeAll(() => {
  const rect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getBoundingClientRect = rect;
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  document.elementFromPoint = () => null;
});

function Essai({ initial, surChangement }: { initial: string; surChangement: (t: string) => void }) {
  const [valeur, setValeur] = useState(initial);
  return (
    <>
      <EditeurTexte
        valeur={valeur}
        etiquette="Nouvelle publication"
        placeholder="Partagez une question…"
        onChange={(t) => {
          setValeur(t);
          surChangement(t);
        }}
      />
      <button type="button" onClick={() => setValeur("")}>
        Vider
      </button>
    </>
  );
}

const editeur = () => screen.findByRole("textbox", { name: "Nouvelle publication" });

describe("L'éditeur", () => {
  it("la barre : titres 1 à 3, gras, italique, souligné, barré, listes, citation", async () => {
    render(<Essai initial="" surChangement={vi.fn()} />);
    await editeur();
    const barre = screen.getByRole("toolbar", { name: "Mise en forme" });
    expect([...barre.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"))).toEqual([
      "Titre 1",
      "Titre 2",
      "Titre 3",
      "Gras",
      "Italique",
      "Souligné",
      "Barré",
      "Liste à puces",
      "Liste numérotée",
      "Citation",
    ]);
  });

  it("tout sélectionner puis Gras : le texte enregistré est en gras, le bouton est actif ; Titre 1 en fait un titre", async () => {
    const user = userEvent.setup({ delay: null });
    const surChangement = vi.fn();
    render(<Essai initial="Bonjour" surChangement={surChangement} />);
    const champ = await editeur();
    expect(champ).toHaveTextContent("Bonjour");
    await user.click(champ);
    await user.keyboard("{Control>}a{/Control}");
    await user.click(screen.getByRole("button", { name: "Gras" }));
    await waitFor(() => expect(surChangement).toHaveBeenLastCalledWith("**Bonjour**"));
    expect(screen.getByRole("button", { name: "Gras" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Titre 1" }));
    await waitFor(() => expect(surChangement).toHaveBeenLastCalledWith("# **Bonjour**"));
  });

  it("vidé de l'extérieur (après Publier) : l'éditeur se vide", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Essai initial="Bonjour" surChangement={vi.fn()} />);
    const champ = await editeur();
    await user.click(screen.getByRole("button", { name: "Vider" }));
    await waitFor(() => expect(champ).not.toHaveTextContent("Bonjour"));
  });
});
