// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { ToastProvider } from "@/components/ui/Toast";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DonneesLecon } from "@/lib/lecon/types";
import { EXCEL_OUVERTE, id } from "./donnees";

const enregistrerNote = vi.fn();
vi.mock("@/lib/lecon/actions", () => ({
  enregistrerNote: (...args: unknown[]) => enregistrerNote(...args),
  lienRessource: vi.fn(),
  lienConsultation: vi.fn(),
  ouvrirLecon: vi.fn(async () => undefined),
  terminerLecon: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));

const { NotesLecon } = await import("@/components/lecon/NotesLecon");
const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");

const DONNEES: DonneesLecon = {
  fiche: EXCEL_OUVERTE,
  lecon: {
    id: id(2),
    titre: "Saisir et mettre en forme des données",
    dureeSecondes: 750,
    apercu: true,
    accessible: true,
    resume: "",
    pointsCles: [],
    video: null,
    texte: "",
    ressources: [],
    visionnage: null,
  },
  note: "Ancienne",
  notesDisponibles: true,
};
/** Onglets ordinateur ([0]) et téléphone ([1]) : les deux existent dans le DOM, l'un masqué selon la largeur. */
const onglets = () => screen.getAllByRole("tablist", { name: "Contenu de la leçon" });
const ouvrir = async (bloc: number, nom: string) => userEvent.click(within(onglets()[bloc]).getByRole("tab", { name: nom }));
const champs = () => screen.getAllByLabelText("Mes notes sur cette leçon");

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

  it("la note enregistrée, ou en cours de saisie, survit à un aller-retour entre onglets", async () => {
    enregistrerNote.mockResolvedValue({ ok: true });
    render(
      <ToastProvider>
        <ContenuLecon donnees={DONNEES} connecte />
      </ToastProvider>,
    );
    await ouvrir(0, "Notes");
    await userEvent.clear(champs()[0]);
    await userEvent.type(champs()[0], "Nouvelle");
    await userEvent.click(screen.getAllByRole("button", { name: "Enregistrer la note" })[0]);
    expect(await screen.findAllByText("Note enregistrée")).not.toHaveLength(0);
    await ouvrir(0, "Ressources");
    await ouvrir(0, "Notes");
    expect(champs()[0]).toHaveValue("Nouvelle");
    await userEvent.type(champs()[0], " (à relire)");
    await ouvrir(0, "Ressources");
    await ouvrir(0, "Notes");
    expect(champs()[0]).toHaveValue("Nouvelle (à relire)");
  });

  it("les onglets de l'ordinateur et du téléphone montrent la même note", async () => {
    render(
      <ToastProvider>
        <ContenuLecon donnees={DONNEES} connecte />
      </ToastProvider>,
    );
    await ouvrir(0, "Notes");
    await userEvent.type(champs()[0], " modifiée");
    await ouvrir(1, "Notes");
    for (const champ of champs()) expect(champ).toHaveValue("Ancienne modifiée");
  });

  it("une coupure réseau pendant l'enregistrement est annoncée, et la saisie est gardée", async () => {
    enregistrerNote.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<NotesLecon leconId={id(2)} noteInitiale={null} connecte disponible />);
    await userEvent.type(screen.getByLabelText("Mes notes sur cette leçon"), "Ma note");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer la note" }));
    expect(await screen.findByText("La note n’a pas pu être enregistrée. Réessayez.")).toBeInTheDocument();
    expect(screen.getByLabelText("Mes notes sur cette leçon")).toHaveValue("Ma note");
    expect(screen.getByRole("button", { name: "Enregistrer la note" })).toBeEnabled();
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
