// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Une fonction absente de la base (migration non appliquée) : l'équipe lit quelle migration appliquer ; un étudiant, un
// formateur ou un visiteur lit seulement « Cette fonction n'est pas disponible pour le moment. ».

const INDISPONIBLE = "Cette fonction n’est pas disponible pour le moment.";

const lireCorrections = vi.fn();
vi.mock("@/lib/exercices/data", () => ({
  lireCorrections: () => lireCorrections(),
  lireRenduACorriger: vi.fn(),
  MIGRATION_EXERCICES: "Appliquez la migration 0032 (guide « Ce qui te revient », section 38).",
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn(), usePathname: () => "/formateur/corrections", useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { PageCorrections } = await import("@/components/corrections/PagesCorrections");
const { siTablesAbsentes, TablesAbsentes } = await import("@/components/admin/TablesAbsentes");
const { TablesAbsentesError } = await import("@/lib/contenus/lecture");

beforeEach(() => lireCorrections.mockReset().mockResolvedValue({ migrationAbsente: true }));

describe("Les fonctions absentes de la base", () => {
  it("Corrections : neutre pour le formateur, la migration pour l'équipe", async () => {
    const { unmount } = render(await PageCorrections({ espace: "formateur" }));
    expect(screen.getByRole("status")).toHaveTextContent(INDISPONIBLE);
    expect(document.body).not.toHaveTextContent(/migration|dans la base/i);
    unmount();
    render(await PageCorrections({ espace: "admin" }));
    expect(screen.getByText("Appliquez la migration 0032 (guide « Ce qui te revient », section 38).")).toBeInTheDocument();
  });

  it("les tables des formations : neutres pour les étudiants, les formateurs et les visiteurs ; l'équipe lit la migration, sans parler de lot", () => {
    const { unmount } = render(siTablesAbsentes(new TablesAbsentesError()));
    expect(screen.getByRole("status")).toHaveTextContent(INDISPONIBLE);
    expect(document.body).not.toHaveTextContent(/migration|lot/i);
    unmount();
    render(<TablesAbsentes equipe />);
    const bandeau = screen.getByRole("status");
    expect(bandeau).toHaveTextContent("Les tables des formations ne sont pas encore dans la base.");
    expect(bandeau).toHaveTextContent("Appliquez la migration 0004, puis la 0005 (guide « Ce qui te revient », section 5).");
    expect(bandeau).not.toHaveTextContent(/lot \d/);
  });

  it("une autre erreur que les tables absentes repart (écran « Une erreur est survenue »)", () => {
    expect(() => siTablesAbsentes(new Error("panne"))).toThrow("panne");
  });
});
