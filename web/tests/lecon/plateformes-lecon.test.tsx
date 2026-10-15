// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { DonneesLecon, LeconDetail } from "@/lib/lecon/types";
import { EXCEL_OUVERTE, id } from "./donnees";

// La page leçon avec une vidéo d'une autre plateforme (spec 2026-10-15-plateformes-video-design, §1 et §3).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));
vi.mock("@/lib/lecon/actions", () => ({ enregistrerNote: vi.fn(), lienRessource: vi.fn(), lienConsultation: vi.fn(), ouvrirLecon: vi.fn(async () => undefined), terminerLecon: vi.fn() }));
vi.mock("@/lib/video/adaptateurs", () => ({ creerAdaptateur: () => new Promise(() => {}) }));

const { ContenuLecon } = await import("@/components/lecon/ContenuLecon");
const { videoMesuree } = await import("@/lib/lecon/regles");

const LECON: LeconDetail = {
  id: id(2),
  titre: "Saisir des données",
  dureeSecondes: 120,
  apercu: true,
  accessible: true,
  resume: "",
  pointsCles: [],
  video: null,
  texte: "",
  ressources: [],
  visionnage: { passages: [], positionSecondes: 0, terminee: false },
};
const avec = (video: LeconDetail["video"]): DonneesLecon => ({ fiche: EXCEL_OUVERTE, lecon: { ...LECON, video }, note: null, notesDisponibles: true });
const afficher = (donnees: DonneesLecon) =>
  render(
    <ToastProvider>
      <ContenuLecon donnees={donnees} connecte />
    </ToastProvider>,
  );

describe("Une vidéo d'une autre plateforme", () => {
  it("Google Drive (sans mesure) : le lecteur officiel, sans le lecteur Étudium ni le temps regardé", () => {
    afficher(avec({ fournisseur: "drive", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345" }));
    expect(screen.getByTitle("Vidéo : Saisir des données")).toHaveAttribute("src", "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/preview");
    expect(screen.queryByRole("button", { name: "Lire la vidéo" })).toBeNull();
    expect(screen.queryByText(/Temps réellement regardé/)).toBeNull();
  });

  it("Google Drive : le bouton « ouvrir dans Drive » est caché par un coin Étudium qui porte notre plein écran ; le plein écran de Drive est coupé (retour du 15 octobre)", () => {
    const { container } = afficher(avec({ fournisseur: "drive", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345" }));
    const iframe = screen.getByTitle("Vidéo : Saisir des données");
    expect(iframe).not.toHaveAttribute("allowfullscreen");
    expect(iframe.getAttribute("allow")).not.toContain("fullscreen");
    const coin = container.querySelector("[data-coin-video]")!;
    expect(coin).not.toBeNull();
    expect(coin.parentElement).toBe(iframe.parentElement);
    expect(screen.getByRole("button", { name: "Plein écran" })).toBeInTheDocument();
  });

  it("YouTube intégré tel quel (aperçu de l'éditeur) : son plein écran, pas de coin", () => {
    const { container } = afficher(avec({ fournisseur: "loom", id: "0123456789abcdef0123456789abcdef" }));
    expect(screen.getByTitle("Vidéo : Saisir des données")).toHaveAttribute("allowfullscreen");
    expect(container.querySelector("[data-coin-video]")).toBeNull();
  });

  it("TikTok (mesurée) : le lecteur Étudium, au format vertical", () => {
    const { container } = afficher(avec({ fournisseur: "tiktok", id: "7234567890123456789" }));
    expect(screen.getByRole("button", { name: "Lire la vidéo" })).toBeInTheDocument();
    expect(container.querySelector('[class~="aspect-[9/16]"]')).not.toBeNull();
    expect(container.querySelector('[class~="aspect-video"]')).toBeNull();
  });

  it("sur ordinateur, la vidéo tient entière à l'écran sous la barre du haut : sa largeur suit la hauteur de l'écran (retour du 15 octobre)", () => {
    const { container } = afficher(avec({ fournisseur: "youtube", id: "dQw4w9WgXcQ" }));
    const cadre = container.querySelector('[class~="aspect-video"]')!;
    expect(cadre.className).toContain("lg:w-[min(100%,calc((100dvh-330px)*16/9))]");
    expect(cadre.className).toContain("mx-auto");
  });

  it("le bouton de fin attend la vidéo seulement si elle est mesurée", () => {
    expect(videoMesuree(LECON)).toBe(false);
    expect(videoMesuree({ ...LECON, video: { fournisseur: "loom", id: "0123456789abcdef0123456789abcdef" } })).toBe(false);
    expect(videoMesuree({ ...LECON, video: { fournisseur: "tella", id: "mon-cours-a1b2" } })).toBe(true);
    expect(videoMesuree({ ...LECON, video: { fournisseur: "youtube", id: "dQw4w9WgXcQ" } })).toBe(true);
  });
});
