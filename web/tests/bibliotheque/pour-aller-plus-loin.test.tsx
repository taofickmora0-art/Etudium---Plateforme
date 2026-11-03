// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { FicheFormation } from "@/lib/catalogue/types";
import { parSlug } from "../catalogue/cartes-design";
import { MEMOIRE, VENDRE } from "./fixtures";

// « Pour aller plus loin » sur la fiche d'une formation (spec du 3 novembre 2026, §1 ; étape C) : les livres que
// l'équipe y recommande (livres_formation), en petites cartes, dans la colonne principale ; rien s'il n'y en a pas.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => "/formations/maitriser-microsoft-excel" }));

const { FichePublique } = await import("@/components/catalogue/FichePublique");
const { FicheConnectee } = await import("@/components/catalogue/FicheConnectee");
const { PourAllerPlusLoin } = await import("@/components/bibliotheque/PourAllerPlusLoin");

const EXCEL: FicheFormation = {
  ...parSlug("maitriser-microsoft-excel"),
  dureeSecondes: 3600,
  nbLecons: 2,
  seuilVideo: 90,
  description: "",
  objectifs: [],
  competences: [],
  formateur: null,
  modules: [{ id: "m1", titre: "Bases", lecons: [{ id: "l1", titre: "Découvrir", dureeSecondes: 300, apercu: true, accessible: true }] }],
};

describe("« Pour aller plus loin »", () => {
  it("les livres recommandés, vers leur fiche, avec leur auteur et leur progression", () => {
    render(<PourAllerPlusLoin livres={[MEMOIRE, VENDRE]} />);
    const section = screen.getByRole("region", { name: "Pour aller plus loin" });
    const liens = within(within(section).getByRole("list")).getAllByRole("link");
    expect(liens.map((a) => a.getAttribute("href"))).toEqual(["/bibliotheque/reussir-son-memoire", "/bibliotheque/vendre-en-ligne"]);
    expect(within(liens[0]).getByText("Mireille Adjovi")).toBeInTheDocument();
    expect(within(liens[0]).getByText("42 % lus")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Toute la bibliothèque" })).toHaveAttribute("href", "/bibliotheque");
  });

  it("aucun livre : pas de section", () => {
    const { container } = render(<PourAllerPlusLoin livres={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("sur la fiche d'un visiteur et d'un compte connecté, dans la colonne principale, avant les avis", () => {
    const { unmount } = render(<FichePublique fiche={EXCEL} livres={[MEMOIRE]} />);
    const section = screen.getByRole("region", { name: "Pour aller plus loin" });
    const avis = screen.getByRole("region", { name: "Avis des étudiants" });
    expect(section.compareDocumentPosition(avis) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.closest("aside")).toBeNull();
    unmount();
    render(
      <ToastProvider>
        <FicheConnectee fiche={EXCEL} livres={[MEMOIRE, VENDRE]} />
      </ToastProvider>,
    );
    expect(within(screen.getByRole("region", { name: "Pour aller plus loin" })).getAllByRole("link", { name: /Réussir son mémoire|Vendre en ligne/ })).toHaveLength(2);
  });

  it("sans livre recommandé (ou sans la 0074) : la fiche d'avant", () => {
    render(<FichePublique fiche={EXCEL} />);
    expect(screen.queryByRole("region", { name: "Pour aller plus loin" })).toBeNull();
  });
});
