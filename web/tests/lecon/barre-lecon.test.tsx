// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { EXCEL_OUVERTE, id } from "./donnees";

// La barre du haut de la leçon et « Terminer la leçon » (refonte des formations, étape B, spec §1.1 à §1.3).
const terminerLecon = vi.fn();
vi.mock("@/lib/lecon/actions", () => ({ terminerLecon: (...a: unknown[]) => terminerLecon(...a), ouvrirLecon: vi.fn(), enregistrerNote: vi.fn(), lienRessource: vi.fn() }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/formations" }));

const { EtatLeconProvider, useEtatLecon } = await import("@/components/lecon/EtatLecon");
const { BoutonFin } = await import("@/components/lecon/BoutonFin");
const { BarreHautLecon } = await import("@/components/lecon/BarreHautLecon");
const { EnTeteLecon } = await import("@/components/lecon/EnTeteLecon");

type Options = { terminee?: boolean; avecVideo?: boolean; actif?: boolean };
const avec = (enfant: ReactNode, { terminee = false, avecVideo = false, actif = true }: Options = {}) => (
  <ToastProvider>
    <EtatLeconProvider termineeInitiale={terminee} avecVideo={avecVideo} seuil={90} actif={actif}>
      {enfant}
    </EtatLeconProvider>
  </ToastProvider>
);
function ValidationDuLecteur() {
  const etat = useEtatLecon();
  return (
    <button type="button" onClick={() => etat?.marquerTerminee()}>
      Valider (lecteur)
    </button>
  );
}
const SUIVANTE = "/formations/x/lecons/3";

describe("« Terminer la leçon »", () => {
  beforeEach(() => {
    terminerLecon.mockReset();
    push.mockReset();
  });

  it("sans vidéo : termine la leçon, puis ouvre la suivante", async () => {
    terminerLecon.mockResolvedValue({ ok: true });
    render(avec(<BoutonFin leconId={id(2)} variante="ordinateur" suivante={SUIVANTE} />));
    await userEvent.click(screen.getByRole("button", { name: "Terminer la leçon" }));
    expect(terminerLecon).toHaveBeenCalledWith(id(2));
    await waitFor(() => expect(push).toHaveBeenCalledWith(SUIVANTE));
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", SUIVANTE);
  });

  it("avec une vidéo : grisé avant le seuil ; au seuil, « Leçon suivante »", async () => {
    render(
      avec(
        <>
          <BoutonFin leconId={id(2)} variante="ordinateur" suivante={SUIVANTE} />
          <ValidationDuLecteur />
        </>,
        { avecVideo: true },
      ),
    );
    expect(screen.getByRole("button", { name: "Terminer la leçon" })).toBeDisabled();
    expect(screen.getByText("Regardez au moins 90 % de la vidéo")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Valider (lecteur)" }));
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toHaveAttribute("href", SUIVANTE);
    expect(push).not.toHaveBeenCalled();
  });

  it("la dernière leçon terminée : « Dernière leçon terminée ! » et le retour à la formation", () => {
    render(avec(<BoutonFin leconId={id(12)} variante="ordinateur" formation="/formations/x" />, { terminee: true }));
    expect(screen.getByText("Dernière leçon terminée !").closest("[role=status]")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Voir la formation" })).toHaveAttribute("href", "/formations/x");
  });

  it("visiteur : pas de bouton, la leçon suivante reste un lien", () => {
    render(avec(<BoutonFin leconId={id(2)} variante="ordinateur" suivante={SUIVANTE} />, { actif: false }));
    expect(screen.queryByRole("button", { name: "Terminer la leçon" })).toBeNull();
    expect(screen.getByRole("link", { name: "Leçon suivante" })).toBeInTheDocument();
  });
});

describe("La barre du haut de la leçon", () => {
  afterEach(() => {
    delete document.documentElement.dataset.lecture;
  });

  it("le titre de la formation mène à sa page ; « Mode lecture » masque le programme ; « Terminer la leçon »", async () => {
    render(avec(<BarreHautLecon titreFormation="Maîtriser Excel" adresseFormation="/formations/x" leconId={id(2)} suivante={SUIVANTE} />));
    expect(screen.getByRole("link", { name: "Maîtriser Excel" })).toHaveAttribute("href", "/formations/x");
    const lecture = screen.getByRole("button", { name: "Mode lecture" });
    expect(lecture).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(lecture);
    expect(lecture).toHaveAttribute("aria-pressed", "true");
    expect(document.documentElement.dataset.lecture).toBe("1");
    await userEvent.click(lecture);
    expect(document.documentElement.dataset.lecture).toBeUndefined();
    expect(screen.getByRole("button", { name: "Terminer la leçon" })).toBeInTheDocument();
  });
});

describe("L'en-tête de la leçon", () => {
  const lecon = { ...EXCEL_OUVERTE.modules[0].lecons[1], resume: "", pointsCles: [], video: null, texte: "", ressources: [], visionnage: null };

  it("« Leçon 2 sur 12 », les flèches, et « Modifier la leçon » pour l'équipe et le formateur", () => {
    const { unmount } = render(<EnTeteLecon fiche={EXCEL_OUVERTE} lecon={lecon} lienModifier="/admin/formations/f/lecons/l" />);
    expect(screen.getByText("Leçon 2 sur 12")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Aller à la leçon précédente" })).toHaveAttribute("href", `/formations/maitriser-microsoft-excel/lecons/${id(1)}`);
    expect(screen.getByRole("link", { name: "Aller à la leçon suivante" })).toHaveAttribute("href", `/formations/maitriser-microsoft-excel/lecons/${id(3)}`);
    expect(screen.getByRole("link", { name: "Modifier la leçon" })).toHaveAttribute("href", "/admin/formations/f/lecons/l");
    unmount();
    render(<EnTeteLecon fiche={EXCEL_OUVERTE} lecon={lecon} />);
    expect(screen.queryByRole("link", { name: "Modifier la leçon" })).toBeNull();
  });
});
