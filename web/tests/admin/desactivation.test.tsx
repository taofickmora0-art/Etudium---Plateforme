// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FormationAdmin } from "@/lib/admin/types";

// Désactiver une formation (lot 5, étape C ; migration 0059) : au back-office, l'équipe désactive une formation publiée
// après une confirmation qui annonce le nombre d'étudiants concernés, et la réactive ; le formateur voit l'état.

const setStatutFormation = vi.fn();
vi.mock("@/lib/admin/actions", () => ({
  setStatutFormation: (...a: unknown[]) => setStatutFormation(...a),
  deleteFormation: vi.fn(),
  envoyerEnRelecture: vi.fn(),
  renvoyerAuFormateur: vi.fn(),
}));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => routeur, usePathname: () => "/admin/formations" }));

const { PublicationPanel } = await import("@/components/admin/PublicationPanel");
const { PublicationFormateur } = await import("@/components/formateur/PublicationFormateur");
const { FiltreStatut } = await import("@/components/admin/FiltreStatut");
const { texteDesactivation } = await import("@/lib/admin/desactivation");

const FORMATION = {
  statut: "publiee",
  etat: "publiee",
  envoyeeLe: null,
  renvoyeeLe: null,
  remarqueRelecture: null,
  modifieeParFormateurLe: null,
  publieeLe: "2026-10-01T08:00:00Z",
  modificationsNonPubliees: false,
} as Pick<FormationAdmin, "statut" | "etat" | "envoyeeLe" | "renvoyeeLe" | "remarqueRelecture" | "modifieeParFormateurLe" | "publieeLe" | "modificationsNonPubliees">;
const avecToast = (enfant: React.ReactNode) => render(<ToastProvider>{enfant}</ToastProvider>);

beforeEach(() => {
  setStatutFormation.mockReset().mockResolvedValue({ ok: true });
});

describe("Désactiver une formation au back-office", () => {
  it("le texte de la confirmation selon le nombre d'étudiants", () => {
    expect(texteDesactivation(12)).toBe("12 étudiants suivent cette formation. Leur accès sera suspendu tout de suite ; ils seront prévenus. Vous pourrez la réactiver.");
    expect(texteDesactivation(1)).toBe("1 étudiant suit cette formation. Son accès sera suspendu tout de suite ; il sera prévenu. Vous pourrez la réactiver.");
    expect(texteDesactivation(0)).toBe("Aucun étudiant ne suit cette formation. Elle disparaîtra du catalogue tout de suite. Vous pourrez la réactiver.");
    expect(texteDesactivation(null)).toBe("L’accès des étudiants qui la suivent sera suspendu tout de suite ; ils seront prévenus. Vous pourrez la réactiver.");
  });

  it("publiée : « Désactiver », confirmation avec le nombre d'étudiants, puis l'action", async () => {
    const user = userEvent.setup();
    avecToast(<PublicationPanel id="f1" formation={FORMATION} formateurNom={null} suiveurs={12} />);
    await user.click(screen.getByRole("button", { name: "Désactiver" }));
    const fenetre = screen.getByRole("dialog", { name: "Désactiver cette formation ?" });
    expect(fenetre).toHaveTextContent(texteDesactivation(12));
    await user.click(within(fenetre).getByRole("button", { name: "Désactiver" }));
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "desactivee");
    expect(await screen.findByText("Formation désactivée")).toBeInTheDocument();
  });

  it("désactivée : l'explication et « Réactiver » (elle redevient publiée) ; ni archiver, ni republier", async () => {
    const user = userEvent.setup();
    avecToast(<PublicationPanel id="f1" formation={{ ...FORMATION, statut: "desactivee", etat: "desactivee" }} formateurNom={null} />);
    expect(screen.getByText("Désactivée : plus aucun accès pour les étudiants. Leur progression, leurs certificats et leurs avis sont gardés.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archiver" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Republier" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Réactiver" }));
    const fenetre = screen.getByRole("dialog", { name: "Réactiver cette formation ?" });
    await user.click(within(fenetre).getByRole("button", { name: "Réactiver" }));
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "publiee");
  });

  it("le filtre « Désactivées » du back-office", () => {
    render(<FiltreStatut valeur="toutes" />);
    expect(within(screen.getByRole("group", { name: "Filtrer les formations" })).getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Toutes",
      "En attente",
      "Brouillons",
      "Publiées",
      "Désactivées",
      "Archivées",
    ]);
  });

  it("le formateur voit l'état, sans bouton pour réactiver", () => {
    avecToast(<PublicationFormateur id="f1" formation={{ ...FORMATION, etat: "desactivee" }} />);
    expect(screen.getByText("Désactivée par l’équipe Étudium : les étudiants n’y ont plus accès. Seule l’équipe peut la réactiver.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
