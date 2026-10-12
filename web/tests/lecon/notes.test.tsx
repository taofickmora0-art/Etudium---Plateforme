// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { id } from "./donnees";

const enregistrerNote = vi.fn();
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: (...args: unknown[]) => enregistrerNote(...args), lienRessource: vi.fn() }));

const { NotesLecon } = await import("@/components/lecon/NotesLecon");

describe("Notes privées d'une leçon", () => {
  beforeEach(() => {
    enregistrerNote.mockReset();
  });

  it("la note se retrouve, se modifie et s'enregistre", async () => {
    enregistrerNote.mockResolvedValue({ ok: true });
    render(<NotesLecon leconId={id(2)} noteInitiale="Ctrl + T" connecte disponible />);
    const champ = screen.getByLabelText("Mes notes sur cette leçon");
    expect(champ).toHaveValue("Ctrl + T");
    expect(champ).toHaveAttribute("maxlength", "5000");
    expect(champ).toHaveAttribute("placeholder", "Notez ce que vous voulez retenir : une formule, un raccourci, une idée pour votre mémoire…");
    expect(screen.getByText("Vos notes sont privées. Vous les retrouvez à chaque retour sur cette leçon.")).toBeInTheDocument();
    await userEvent.type(champ, ", puis Insertion");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la note" }));
    expect(enregistrerNote).toHaveBeenCalledWith(id(2), "Ctrl + T, puis Insertion");
    expect(await screen.findByText("Note enregistrée")).toBeInTheDocument();
    // Une nouvelle saisie efface le message : il ne doit pas laisser croire que la suite est enregistrée.
    await userEvent.type(champ, ".");
    expect(screen.queryByText("Note enregistrée")).toBeNull();
  });

  it("un échec est annoncé", async () => {
    enregistrerNote.mockResolvedValue({ ok: false, erreur: "La note n’a pas pu être enregistrée. Réessayez." });
    render(<NotesLecon leconId={id(2)} noteInitiale={null} connecte disponible />);
    await userEvent.type(screen.getByLabelText("Mes notes sur cette leçon"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la note" }));
    expect(await screen.findByText("La note n’a pas pu être enregistrée. Réessayez.")).toBeInTheDocument();
  });

  it("un visiteur est invité à créer son compte", () => {
    render(<NotesLecon leconId={id(2)} noteInitiale={null} connecte={false} disponible />);
    expect(screen.getByText("Vos notes sont privées : créez un compte gratuit pour en prendre.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Créer un compte gratuit" })).toHaveAttribute("href", "/inscription");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("sans la table des notes, un message le dit", () => {
    render(<NotesLecon leconId={id(2)} noteInitiale={null} connecte disponible={false} />);
    expect(screen.getByText("Les notes seront disponibles quand la base sera à jour (fichier 0006).")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
