// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { EtatEdition, SaisieInfos } from "@/lib/editeur/types";

// Les informations générales d'une formation (fin du lot 4, spec §2.2) : enregistrées toutes seules, dans un brouillon
// si la formation est en ligne ; les réglages restent à part, avec leur bouton.

vi.mock("@/lib/editeur/actions", () => ({
  enregistrerInfosFormation: vi.fn(),
  publierModifications: vi.fn(),
  lireModificationsEnAttente: vi.fn(async () => ({ migrationAbsente: false, donnees: [] })),
}));
const { enregistrerInfosFormation } = await import("@/lib/editeur/actions");
const { InfosGenerales } = await import("@/components/editeur/InfosGenerales");

const F = "44444444-4444-4444-8444-444444444444";
const EDITION: EtatEdition<SaisieInfos> = {
  donnees: { titre: "Excel", resume: "Court", description: "Long", objectifs: ["Calculer"], competences: ["Excel"], niveau: "debutant" },
  revision: 2,
  brouillon: false,
  enLigne: true,
  modifiePar: null,
  modifieLe: null,
};
const afficher = (edition = EDITION) =>
  render(
    <ToastProvider>
      <InfosGenerales formationId={F} edition={edition} />
    </ToastProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  vi.mocked(enregistrerInfosFormation).mockReset();
  vi.mocked(enregistrerInfosFormation).mockResolvedValue({ ok: true, revision: 3, brouillon: true, enregistreLe: "2026-11-01T14:32:00" });
});

describe("Informations générales", () => {
  it("les champs, l'indicateur ; pas de bouton Enregistrer", () => {
    afficher();
    const carte = screen.getByRole("region", { name: "Informations générales" });
    expect(within(carte).getByRole("textbox", { name: "Titre" })).toHaveValue("Excel");
    expect(within(carte).getByRole("textbox", { name: "Résumé" })).toHaveValue("Court");
    expect(within(carte).getByRole("textbox", { name: "Description" })).toHaveValue("Long");
    expect(within(carte).getByRole("textbox", { name: "Ce que vous allez apprendre" })).toHaveValue("Calculer");
    expect(within(carte).getByRole("textbox", { name: "Compétences acquises" })).toHaveValue("Excel");
    expect(within(carte).getByRole("combobox", { name: "Niveau" })).toHaveValue("debutant");
    expect(within(carte).getByText("Enregistré")).toHaveAttribute("role", "status");
    expect(within(carte).queryByRole("button", { name: "Enregistrer" })).toBeNull();
  });

  it("modifier le titre l'enregistre seul, avec la révision ; formation en ligne : « Modifications non publiées »", async () => {
    const user = userEvent.setup();
    afficher();
    await user.type(screen.getByRole("textbox", { name: "Titre" }), " avancé");
    await waitFor(() => expect(enregistrerInfosFormation).toHaveBeenCalled(), { timeout: 3000 });
    const [formation, saisie, revision] = vi.mocked(enregistrerInfosFormation).mock.calls[0];
    expect(formation).toBe(F);
    expect(revision).toBe(2);
    expect(saisie).toMatchObject({ titre: "Excel avancé", objectifs: ["Calculer"], niveau: "debutant" });
    expect(await screen.findByText("Brouillon enregistré à 14 h 32")).toBeInTheDocument();
    expect(screen.getByText("Modifications non publiées")).toBeInTheDocument();
  });

  it("une erreur de saisie s'affiche sous son champ", async () => {
    const user = userEvent.setup();
    vi.mocked(enregistrerInfosFormation).mockResolvedValue({ ok: false, code: "invalide", erreurs: { titre: "Entrez le titre de la formation." } });
    afficher();
    await user.clear(screen.getByRole("textbox", { name: "Titre" }));
    expect(await screen.findByText("Entrez le titre de la formation.", undefined, { timeout: 3000 })).toBeInTheDocument();
  });
});
