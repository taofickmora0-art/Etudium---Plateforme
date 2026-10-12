// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AppError from "@/app/(app)/error";

describe("Erreur dans l'espace connecté", () => {
  it("un incident propose de réessayer, en français", async () => {
    const retry = vi.fn();
    const user = userEvent.setup();
    render(<AppError error={new Error("Supabase injoignable")} retry={retry} />);
    expect(screen.getByRole("heading", { name: "Une erreur est survenue" })).toBeInTheDocument();
    expect(screen.getByText("Vérifiez votre connexion, puis réessayez.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
