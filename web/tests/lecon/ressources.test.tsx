// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RessourceLecon } from "@/lib/lecon/types";
import { id } from "./donnees";

const lienRessource = vi.fn();
vi.mock("@/lib/lecon/actions", () => ({ lienRessource: (...args: unknown[]) => lienRessource(...args), enregistrerNote: vi.fn() }));

const { RessourcesLecon } = await import("@/components/lecon/RessourcesLecon");

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const RESSOURCES: RessourceLecon[] = [
  { id: id(301), titre: "Classeur d’exemple", format: XLSX, tailleOctets: 84_000, telechargeable: true },
  { id: id(302), titre: "Guide des tableaux croisés", format: "application/pdf", tailleOctets: 1_200_000, telechargeable: false },
];

describe("Ressources d'une leçon", () => {
  const assign = vi.fn();
  const location = window.location;

  beforeEach(() => {
    lienRessource.mockReset();
    assign.mockReset();
    Object.defineProperty(window, "location", { configurable: true, value: { ...location, assign } });
  });
  afterEach(() => {
    Object.defineProperty(window, "location", { configurable: true, value: location });
  });

  it("chaque fichier dit son format, sa taille et son mode d'accès", () => {
    render(<RessourcesLecon ressources={RESSOURCES} />);
    expect(screen.getByText("Classeur d’exemple")).toBeInTheDocument();
    expect(screen.getByText("Excel · 84 Ko · téléchargeable")).toBeInTheDocument();
    expect(screen.getByText("PDF · 1,2 Mo · consultation seule")).toBeInTheDocument();
  });

  it("« Télécharger » demande un lien temporaire puis l'ouvre", async () => {
    lienRessource.mockResolvedValue({ url: "https://stockage/lien-signe" });
    render(<RessourcesLecon ressources={RESSOURCES} />);
    await userEvent.click(screen.getByRole("button", { name: "Télécharger Classeur d’exemple" }));
    expect(lienRessource).toHaveBeenCalledWith(id(301));
    expect(assign).toHaveBeenCalledWith("https://stockage/lien-signe");
  });

  it("un refus est annoncé", async () => {
    lienRessource.mockResolvedValue({ erreur: "Ce fichier n’est pas accessible." });
    render(<RessourcesLecon ressources={RESSOURCES} />);
    await userEvent.click(screen.getByRole("button", { name: "Télécharger Classeur d’exemple" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ce fichier n’est pas accessible.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("une coupure réseau est annoncée et le bouton redevient utilisable", async () => {
    lienRessource.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<RessourcesLecon ressources={RESSOURCES} />);
    const bouton = screen.getByRole("button", { name: "Télécharger Classeur d’exemple" });
    await userEvent.click(bouton);
    expect(await screen.findByRole("alert")).toHaveTextContent("Le lien n’a pas pu être créé. Réessayez.");
    expect(bouton).toBeEnabled();
  });

  it("« Consulter » attend le visualiseur (tâche 1.8)", () => {
    render(<RessourcesLecon ressources={RESSOURCES} />);
    const consulter = screen.getByRole("button", { name: "Consulter Guide des tableaux croisés" });
    expect(consulter).toBeDisabled();
    expect(consulter).toHaveAttribute("title", "Bientôt disponible");
  });

  it("sans ressource, la liste le dit", () => {
    render(<RessourcesLecon ressources={[]} />);
    expect(screen.getByText("Aucune ressource pour cette leçon.")).toBeInTheDocument();
  });
});
