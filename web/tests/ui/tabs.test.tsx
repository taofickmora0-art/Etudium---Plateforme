// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterChips } from "@/components/ui/FilterChips";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";

const FILTRES = [
  { value: "toutes", label: "Toutes" },
  { value: "enCours", label: "En cours" },
  { value: "terminees", label: "Terminées" },
];

describe("FilterChips", () => {
  it("marque le filtre actif et signale le changement", async () => {
    const onValueChange = vi.fn();
    render(<FilterChips label="Filtrer mes formations" options={FILTRES} value="toutes" onValueChange={onValueChange} />);
    expect(screen.getByRole("button", { name: "Toutes" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "En cours" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Terminées" }));
    expect(onValueChange).toHaveBeenCalledWith("terminees");
  });
});

describe("SegmentedTabs", () => {
  it("change d'onglet au clavier", async () => {
    render(
      <SegmentedTabs
        label="Profil"
        defaultValue="informations"
        items={[
          { value: "informations", label: "Informations", content: <p>Contenu informations</p> },
          { value: "notifications", label: "Notifications", content: <p>Contenu notifications</p> },
        ]}
      />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Informations" }));
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Notifications" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Contenu notifications")).toBeVisible();
  });
});
