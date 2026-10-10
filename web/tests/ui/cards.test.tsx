// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CatalogCard } from "@/components/ui/CatalogCard";
import { CourseCard } from "@/components/ui/CourseCard";
import { DataTable } from "@/components/ui/DataTable";
import { Pagination } from "@/components/ui/Pagination";

const EXCEL = {
  href: "/formations/excel",
  title: "Maîtriser Microsoft Excel",
  description: "Formules, tableaux croisés dynamiques et graphiques pour analyser vos données.",
  parcours: "academique" as const,
  timeLabel: "2 h restantes",
};

describe("Cartes", () => {
  it("une carte verrouillée l'annonce", () => {
    render(<CourseCard {...EXCEL} progress={35} timeLabel="Accès expiré" state="verrouillee" />);
    expect(screen.getByText("Verrouillée")).toBeVisible();
    expect(screen.getByRole("link", { name: /Maîtriser Microsoft Excel/ })).toHaveAccessibleName(/Verrouillée/);
  });

  it("la barre suit la progression", () => {
    render(<CourseCard {...EXCEL} progress={68} state="enCours" />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "68");
  });

  it("la carte du catalogue lit la note en clair", () => {
    render(
      <CatalogCard
        href="/catalogue/freelance"
        title="Lancer son activité de freelance"
        description="Offre, tarifs, premiers clients."
        parcours="business"
        rating={4.8}
        reviews={69}
        duration="6 h 00"
        level="Intermédiaire"
      />,
    );
    expect(screen.getByText("4,8 (69)")).toBeVisible();
    expect(screen.getByText("Note 4,8 sur 5, 69 avis")).toHaveClass("sr-only");
  });
});

describe("Pagination", () => {
  it("désactive Précédent en page 1", () => {
    render(<Pagination page={1} pageCount={3} onPageChange={() => {}} />);
    expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Page 1" })).toHaveAttribute("aria-current", "page");
  });

  it("appelle onPageChange(3) au clic sur « 3 »", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageCount={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole("button", { name: "Page 3" }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("résume les longues listes autour de la page courante", () => {
    render(<Pagination page={10} pageCount={20} onPageChange={() => {}} />);
    const pages = screen.getAllByRole("button", { name: /^Page \d+$/ }).map((b) => b.textContent);
    expect(pages).toEqual(["1", "9", "10", "11", "20"]);
  });
});

describe("DataTable", () => {
  it("affiche une ligne par élément", () => {
    const rows = [
      { date: "14/09/2026", objet: "Formule Standard · 1 mois" },
      { date: "02/09/2026", objet: "Formation complémentaire" },
      { date: "14/08/2026", objet: "Formule Basique · 1 mois" },
    ];
    render(
      <DataTable
        caption="Historique des paiements"
        columns={[
          { key: "date", header: "Date" },
          { key: "objet", header: "Objet" },
        ]}
        rows={rows}
      />,
    );
    const table = screen.getByRole("table", { name: "Historique des paiements" });
    const body = within(table).getAllByRole("rowgroup")[1];
    expect(within(body).getAllByRole("row")).toHaveLength(3);
  });
});
