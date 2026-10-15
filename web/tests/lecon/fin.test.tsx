// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { id } from "./donnees";

const terminerLecon = vi.fn();
const ouvrirLecon = vi.fn();
vi.mock("@/lib/lecon/actions", () => ({
  terminerLecon: (...a: unknown[]) => terminerLecon(...a),
  ouvrirLecon: (...a: unknown[]) => ouvrirLecon(...a),
  enregistrerNote: vi.fn(),
  lienRessource: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations" }));

const { EtatLeconProvider, useEtatLecon } = await import("@/components/lecon/EtatLecon");
const { BoutonFin } = await import("@/components/lecon/BoutonFin");
const { VisiteLecon } = await import("@/components/lecon/VisiteLecon");

type Options = { terminee?: boolean; avecVideo?: boolean; actif?: boolean };
const avec = (enfant: ReactNode, { terminee = false, avecVideo = false, actif = true }: Options = {}) => (
  <ToastProvider>
    <EtatLeconProvider termineeInitiale={terminee} avecVideo={avecVideo} seuil={90} actif={actif}>
      {enfant}
    </EtatLeconProvider>
  </ToastProvider>
);

/** Ce que fait le lecteur quand la base valide la leçon. */
function ValidationDuLecteur() {
  const etat = useEtatLecon();
  return (
    <button type="button" onClick={() => etat?.marquerTerminee()}>
      Valider (lecteur)
    </button>
  );
}

describe("Bouton de fin d'une leçon", () => {
  beforeEach(() => {
    terminerLecon.mockReset();
    ouvrirLecon.mockReset();
  });

  it("une leçon sans vidéo se termine par le bouton", async () => {
    terminerLecon.mockResolvedValue({ ok: true });
    render(avec(<BoutonFin leconId={id(2)} variante="ordinateur" />));
    await userEvent.click(screen.getByRole("button", { name: "Terminer la leçon" }));
    expect(terminerLecon).toHaveBeenCalledWith(id(2));
    expect(await screen.findByText("Dernière leçon terminée !")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminer la leçon" })).toBeNull();
  });

  it("un échec est annoncé, et le bouton reste disponible", async () => {
    terminerLecon.mockResolvedValue({ ok: false, erreur: "La leçon n’a pas pu être marquée comme terminée. Réessayez." });
    render(avec(<BoutonFin leconId={id(2)} variante="ordinateur" />));
    await userEvent.click(screen.getByRole("button", { name: "Terminer la leçon" }));
    expect(await screen.findByText("La leçon n’a pas pu être marquée comme terminée. Réessayez.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer la leçon" })).toBeEnabled();
  });

  it("une coupure réseau est annoncée de la même façon", async () => {
    terminerLecon.mockRejectedValue(new TypeError("Failed to fetch"));
    render(avec(<BoutonFin leconId={id(2)} variante="ordinateur" />));
    await userEvent.click(screen.getByRole("button", { name: "Terminer la leçon" }));
    expect(await screen.findByText("La leçon n’a pas pu être marquée comme terminée. Réessayez.")).toBeInTheDocument();
  });

  it("une leçon vidéo : bouton grisé jusqu'à la validation par le lecteur", async () => {
    render(
      avec(
        <>
          <BoutonFin leconId={id(1)} variante="ordinateur" />
          <ValidationDuLecteur />
        </>,
        { avecVideo: true },
      ),
    );
    expect(screen.getByRole("button", { name: "Terminer la leçon" })).toBeDisabled();
    expect(screen.getByText("Regardez au moins 90 % de la vidéo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Valider (lecteur)" }));
    expect(screen.getByText("Dernière leçon terminée !")).toBeInTheDocument();
    expect(screen.queryByText("Regardez au moins 90 % de la vidéo")).toBeNull();
  });

  it("téléphone : une fois la leçon terminée, le bouton mène à la leçon suivante", () => {
    render(avec(<BoutonFin leconId={id(2)} variante="telephone" suivante="/formations/x/lecons/3" />, { terminee: true }));
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", "/formations/x/lecons/3");
  });

  it("visiteur (ou progression indisponible) : pas de bouton ; le téléphone garde « Leçon suivante »", () => {
    const { unmount } = render(avec(<BoutonFin leconId={id(2)} variante="ordinateur" />, { actif: false }));
    expect(screen.queryByRole("button")).toBeNull();
    unmount();
    render(avec(<BoutonFin leconId={id(2)} variante="telephone" suivante="/formations/x/lecons/3" />, { actif: false }));
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Terminer la leçon" })).toBeNull();
  });
});

describe("Visite d'une leçon", () => {
  it("est notée une fois, au montage de la page", () => {
    ouvrirLecon.mockResolvedValue(undefined);
    render(<VisiteLecon leconId={id(4)} />);
    expect(ouvrirLecon).toHaveBeenCalledWith(id(4));
  });
});
