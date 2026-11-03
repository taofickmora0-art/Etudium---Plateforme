// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Les dates d'un code promo au style d'Étudium (demande du 3 novembre 2026 : plus d'élément natif du navigateur) :
// le calendrier dessiné des sessions live (ChampDate), et non le calendrier du système.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/admin/paiements/actions", () => ({ enregistrerCodePromo: vi.fn(), basculerCodePromo: vi.fn() }));

const { OngletCodesPromo } = await import("@/components/admin/paiements/OngletCodesPromo");

describe("Les dates d'un code promo", () => {
  it("début et fin se choisissent dans le calendrier d'Étudium, sans champ de date natif", async () => {
    render(<OngletCodesPromo codes={[]} ecriture />);
    await userEvent.click(screen.getByRole("button", { name: "Nouveau code" }));
    expect(document.querySelector('input[type="date"]')).toBeNull();
    expect(screen.getByLabelText("Début (facultatif)")).toHaveAttribute("placeholder", "jj/mm/aaaa");
    expect(screen.getByLabelText("Fin (facultatif)")).toHaveAttribute("placeholder", "jj/mm/aaaa");
    expect(screen.getAllByRole("button", { name: "Choisir une date" })).toHaveLength(2);
  });
});
