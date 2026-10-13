// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { AvisEquipe } from "@/lib/avis/types";
import { id } from "../lecon/donnees";

const masquerAvis = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/admin/avis" }));
vi.mock("@/lib/avis/actions", () => ({ masquerAvis: (...a: unknown[]) => masquerAvis(...a), enregistrerAvis: vi.fn(), supprimerAvis: vi.fn() }));

const { ListeAvis } = await import("@/components/admin/ListeAvis");

const AVIS: AvisEquipe[] = [
  { id: id(1), formationTitre: "Maîtriser Microsoft Excel", formationSlug: "maitriser-microsoft-excel", auteur: "Fifamè A.", note: 4, commentaire: "Très clair.", masque: false, creeLe: "2026-10-12T10:00:00Z" },
  { id: id(2), formationTitre: "Zotero : gérer ses références", formationSlug: "zotero-gerer-ses-references", auteur: "Rodrigue H.", note: 1, commentaire: "", masque: true, creeLe: "2026-10-11T10:00:00Z" },
];
const monter = (avis = AVIS) =>
  render(
    <ToastProvider>
      <ListeAvis avis={avis} />
    </ToastProvider>,
  );

describe("Back-office : avis", () => {
  beforeEach(() => masquerAvis.mockReset());

  it("chaque avis : formation, auteur, note, commentaire, date ; les masqués sont signalés", () => {
    monter();
    const lignes = within(screen.getByRole("list", { name: "Avis des étudiants" })).getAllByRole("listitem");
    expect(within(lignes[0]).getByText("Maîtriser Microsoft Excel")).toBeInTheDocument();
    expect(within(lignes[0]).getByText(/Fifamè A\./)).toBeInTheDocument();
    expect(within(lignes[0]).getByText(/4 sur 5/)).toBeInTheDocument();
    expect(within(lignes[0]).getByText(/12 octobre 2026/)).toBeInTheDocument();
    expect(within(lignes[0]).getByText("Très clair.")).toBeInTheDocument();
    expect(within(lignes[0]).getByRole("button", { name: "Masquer" })).toBeInTheDocument();
    expect(within(lignes[1]).getByText("Masqué")).toBeInTheDocument();
    expect(within(lignes[1]).getByRole("button", { name: "Réafficher" })).toBeInTheDocument();
  });

  it("masquer : l'avis passe « Masqué » et le bouton devient « Réafficher » ; un échec le dit", async () => {
    masquerAvis.mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    monter();
    const ligne = within(screen.getByRole("list", { name: "Avis des étudiants" })).getAllByRole("listitem")[0];
    await user.click(within(ligne).getByRole("button", { name: "Masquer" }));
    expect(masquerAvis).toHaveBeenCalledWith(id(1), true);
    expect(await within(ligne).findByText("Masqué")).toBeInTheDocument();
    expect(within(ligne).getByRole("button", { name: "Réafficher" })).toBeInTheDocument();
    expect(await screen.findByText("Avis masqué.")).toBeInTheDocument();
    masquerAvis.mockResolvedValue({ ok: false, erreur: "L’avis n’a pas pu être modifié. Réessayez." });
    await user.click(within(ligne).getByRole("button", { name: "Réafficher" }));
    expect(masquerAvis).toHaveBeenLastCalledWith(id(1), false);
    expect(await screen.findByText("L’avis n’a pas pu être modifié. Réessayez.")).toBeInTheDocument();
    expect(within(ligne).getByText("Masqué")).toBeInTheDocument();
  });

  it("sans avis : « Aucun avis pour le moment »", () => {
    monter([]);
    expect(screen.getByText("Aucun avis pour le moment")).toBeInTheDocument();
  });
});
