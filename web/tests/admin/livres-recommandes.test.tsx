// @vitest-environment jsdom
import { render as rendre, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { LivreRecommande } from "@/lib/bibliotheque/types";
import { choisirDansListe } from "../utilitaires/listes";

// « Livres recommandés » de la fiche d'une formation au back-office (Bibliothèque, 0074 ; prépare « Pour aller plus
// loin » des étudiants) : choisir des livres publiés, en retirer, les ranger.

const ajouterLivreFormation = vi.fn();
const retirerLivreFormation = vi.fn();
const rangerLivreFormation = vi.fn();
vi.mock("@/lib/bibliotheque/actions", () => ({
  ajouterLivreFormation: (...a: unknown[]) => ajouterLivreFormation(...a),
  retirerLivreFormation: (...a: unknown[]) => retirerLivreFormation(...a),
  rangerLivreFormation: (...a: unknown[]) => rangerLivreFormation(...a),
}));

const { LivresRecommandes } = await import("@/components/admin/bibliotheque/LivresRecommandes");

const F = "f1";
const RECOMMANDES: LivreRecommande[] = [
  { id: "l1", titre: "Réussir son mémoire", auteur: "Dr Mireille Adjovi", statut: "publie", couverture: null },
  { id: "l2", titre: "Ancienne édition", auteur: "", statut: "archive", couverture: null },
];
const PUBLIES = [
  { id: "l1", titre: "Réussir son mémoire", auteur: "Dr Mireille Adjovi" },
  { id: "l3", titre: "Modèle de CV", auteur: "Équipe Étudium" },
  { id: "l4", titre: "Guide du stage", auteur: "" },
];
const afficher = (recommandes: LivreRecommande[] | null = RECOMMANDES, publies = PUBLIES) =>
  rendre(
    <ToastProvider>
      <LivresRecommandes formationId={F} recommandes={recommandes} publies={publies} />
    </ToastProvider>,
  );
const bloc = () => within(screen.getByRole("region", { name: "Livres recommandés" }));

beforeEach(() => {
  for (const f of [ajouterLivreFormation, retirerLivreFormation, rangerLivreFormation]) {
    f.mockReset();
    f.mockResolvedValue({ ok: true });
  }
});

describe("Les livres recommandés d'une formation", () => {
  it("la liste dans l'ordre ; un livre archivé est marqué, il n'est plus montré aux apprenants", () => {
    afficher();
    const lignes = within(bloc().getByRole("list", { name: "Livres recommandés, dans l’ordre" })).getAllByRole("listitem");
    expect(lignes.map((l) => within(l).getAllByText(/./)[0].textContent)).toEqual(["Réussir son mémoire", "Ancienne édition"]);
    expect(within(lignes[0]).getByText("Dr Mireille Adjovi")).toBeInTheDocument();
    expect(within(lignes[1]).getByText("Archivé")).toBeInTheDocument();
    expect(within(lignes[1]).getByText("N’est plus montré aux apprenants")).toBeInTheDocument();
    expect(bloc().getByRole("button", { name: "Monter « Réussir son mémoire »" })).toBeDisabled();
    expect(bloc().getByRole("button", { name: "Descendre « Ancienne édition »" })).toBeDisabled();
  });

  it("ajouter : seuls les livres publiés pas encore recommandés sont proposés", async () => {
    const u = userEvent.setup();
    afficher();
    expect(bloc().getByRole("button", { name: "Ajouter" })).toBeDisabled();
    await u.click(bloc().getByRole("combobox", { name: "Ajouter un livre publié" }));
    expect(within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent)).toEqual(["Modèle de CV · Équipe Étudium", "Guide du stage"]);
    await u.keyboard("{Escape}");
    await choisirDansListe("Ajouter un livre publié", "Guide du stage", { user: u });
    await u.click(bloc().getByRole("button", { name: "Ajouter" }));
    await waitFor(() => expect(ajouterLivreFormation).toHaveBeenCalledWith(F, "l4"));
    expect(await screen.findByText("Livre recommandé")).toBeInTheDocument();
  });

  it("ranger et retirer ; un refus s'affiche", async () => {
    const u = userEvent.setup();
    afficher();
    await u.click(bloc().getByRole("button", { name: "Descendre « Réussir son mémoire »" }));
    await waitFor(() => expect(rangerLivreFormation).toHaveBeenCalledWith(F, "l1", 2));
    await u.click(bloc().getByRole("button", { name: "Monter « Ancienne édition »" }));
    await waitFor(() => expect(rangerLivreFormation).toHaveBeenCalledWith(F, "l2", 1));
    retirerLivreFormation.mockResolvedValue({ ok: false, message: "Vous n’avez pas accès à cette partie du back-office." });
    await u.click(bloc().getByRole("button", { name: "Retirer « Ancienne édition »" }));
    await waitFor(() => expect(retirerLivreFormation).toHaveBeenCalledWith(F, "l2"));
    expect(await screen.findByText("Vous n’avez pas accès à cette partie du back-office.")).toBeInTheDocument();
  });

  it("sans livre publié, sans recommandation, ou sans la 0074 : ce qu'il faut faire", () => {
    const { unmount } = afficher([], []);
    expect(bloc().getByText("Aucun livre recommandé pour le moment.")).toBeInTheDocument();
    expect(bloc().getByText("Publiez d’abord un livre dans la Bibliothèque pour le recommander ici.")).toBeInTheDocument();
    unmount();
    afficher(null, []);
    expect(bloc().getByText("Appliquez la migration 0074 (guide « Ce qui te revient », section 73).")).toBeInTheDocument();
  });
});
