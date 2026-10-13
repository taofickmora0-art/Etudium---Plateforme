// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RessourceLecon } from "@/lib/lecon/types";
import type { DocumentPdf } from "@/lib/ressources/pdf";
import { id } from "./donnees";

vi.mock("@/lib/lecon/actions", () => ({ lienConsultation: vi.fn(), lienRessource: vi.fn(), enregistrerNote: vi.fn() }));

const { VisualiseurRessource } = await import("@/components/lecon/VisualiseurRessource");

const PDF: RessourceLecon = { id: id(302), titre: "Guide des tableaux croisés", format: "application/pdf", tailleOctets: 1_200_000, telechargeable: false };
const IMAGE: RessourceLecon = { id: id(303), titre: "Schéma du tableau", format: "image/png", tailleOctets: 80_000, telechargeable: false };

function fauxDocument(pages = 3) {
  const document = {
    pages,
    dessiner: vi.fn<DocumentPdf["dessiner"]>(async () => undefined),
    fermer: vi.fn(),
  };
  return document satisfies DocumentPdf;
}

const attendre = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });

describe("Visualiseur des ressources en consultation seule", () => {
  const consulter = vi.fn();
  const ouvrir = vi.fn();
  const fetchSimule = vi.fn(async () => new Response(new ArrayBuffer(8), { status: 200 }));

  beforeEach(() => {
    consulter.mockReset();
    ouvrir.mockReset();
    fetchSimule.mockClear();
    vi.stubGlobal("fetch", fetchSimule);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const monter = async (ressource: RessourceLecon | null, onFermer = vi.fn()) => {
    render(<VisualiseurRessource ressource={ressource} onFermer={onFermer} ouvrir={ouvrir} consulter={consulter} />);
    await attendre();
    return onFermer;
  };

  it("un PDF s'affiche page par page, sans bouton de téléchargement ni d'impression", async () => {
    const document = fauxDocument();
    consulter.mockResolvedValue({ url: "https://stockage/guide?token=abc", format: "application/pdf" });
    ouvrir.mockResolvedValue(document);
    await monter(PDF);
    expect(consulter).toHaveBeenCalledWith(PDF.id);
    expect(fetchSimule).toHaveBeenCalledWith("https://stockage/guide?token=abc");
    expect(ouvrir).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    const dialogue = screen.getByRole("dialog", { name: "Guide des tableaux croisés" });
    expect(within(dialogue).getByText("3 pages")).toBeInTheDocument();
    expect(within(dialogue).getAllByRole("img", { name: /^Page \d sur 3$/ })).toHaveLength(3);
    expect(document.dessiner).toHaveBeenCalledWith(1, expect.any(HTMLCanvasElement), expect.any(Number));
    expect(within(dialogue).queryByRole("link")).toBeNull();
    expect(within(dialogue).queryByRole("button", { name: /Télécharger|Imprimer/ })).toBeNull();
    expect(within(dialogue).getByText("Document en consultation seule.")).toBeInTheDocument();
    expect(within(dialogue).getByText("L’impression de ce document n’est pas disponible.")).toBeInTheDocument();
  });

  it("le zoom agrandit et réduit les pages (75 % à 200 %)", async () => {
    const document = fauxDocument(1);
    consulter.mockResolvedValue({ url: "https://stockage/guide", format: "application/pdf" });
    ouvrir.mockResolvedValue(document);
    await monter(PDF);
    const largeurAvant = document.dessiner.mock.calls.at(-1)![2] as number;
    await userEvent.click(screen.getByRole("button", { name: "Agrandir" }));
    await attendre();
    expect(screen.getByText("125 %")).toBeInTheDocument();
    expect(document.dessiner.mock.calls.at(-1)![2]).toBeGreaterThan(largeurAvant);
    await userEvent.click(screen.getByRole("button", { name: "Réduire" }));
    await userEvent.click(screen.getByRole("button", { name: "Réduire" }));
    expect(screen.getByText("75 %")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Réduire" })).toBeDisabled();
  });

  it("une image s'affiche telle quelle, sans lecture de PDF", async () => {
    consulter.mockResolvedValue({ url: "https://stockage/schema?token=abc", format: "image/png" });
    await monter(IMAGE);
    expect(screen.getByRole("img", { name: "Schéma du tableau" })).toHaveAttribute("src", "https://stockage/schema?token=abc");
    expect(fetchSimule).not.toHaveBeenCalled();
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it("un refus du lien est annoncé ; une lecture impossible propose de réessayer", async () => {
    consulter.mockResolvedValue({ erreur: "Ce fichier n’est pas accessible." });
    const { unmount } = render(<VisualiseurRessource ressource={PDF} onFermer={vi.fn()} ouvrir={ouvrir} consulter={consulter} />);
    await attendre();
    expect(screen.getByText("Ce fichier n’est pas accessible.")).toBeInTheDocument();
    unmount();

    consulter.mockResolvedValue({ url: "https://stockage/guide", format: "application/pdf" });
    ouvrir.mockRejectedValueOnce(new Error("PDF illisible")).mockResolvedValue(fauxDocument(2));
    await monter(PDF);
    expect(screen.getByText("Ce document n’a pas pu être affiché.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Réessayer" }));
    await attendre();
    expect(screen.getByText("2 pages")).toBeInTheDocument();
  });

  it("fermer libère le document", async () => {
    const document = fauxDocument();
    consulter.mockResolvedValue({ url: "https://stockage/guide", format: "application/pdf" });
    ouvrir.mockResolvedValue(document);
    const onFermer = vi.fn();
    const { rerender } = render(<VisualiseurRessource ressource={PDF} onFermer={onFermer} ouvrir={ouvrir} consulter={consulter} />);
    await attendre();
    await userEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onFermer).toHaveBeenCalled();
    rerender(<VisualiseurRessource ressource={null} onFermer={onFermer} ouvrir={ouvrir} consulter={consulter} />);
    await attendre();
    expect(document.fermer).toHaveBeenCalled();
  });
});
