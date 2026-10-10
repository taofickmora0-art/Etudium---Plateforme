// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Banner } from "@/components/ui/Banner";
import { Spinner } from "@/components/ui/Spinner";
import { ToastProvider, useToast, type ToastOptions } from "@/components/ui/Toast";

function Declencheur({ options }: { options: ToastOptions }) {
  const { toast } = useToast();
  return (
    <button type="button" onClick={() => toast(options)}>
      Déclencher
    </button>
  );
}

describe("Bandeaux", () => {
  it("un bandeau d'erreur est une alerte", () => {
    const { rerender } = render(
      <Banner tone="erreur" title="Le paiement n’a pas abouti.">
        Aucun montant n’a été débité.
      </Banner>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Le paiement n’a pas abouti.");
    for (const tone of ["attention", "information", "reussite"] as const) {
      rerender(
        <Banner tone={tone} title="Titre">
          Texte
        </Banner>,
      );
      expect(screen.getByRole("status")).toHaveTextContent("Titre");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    }
  });
});

describe("Notifications éphémères", () => {
  // shouldAdvanceTime : Testing Library attend un minuteur de 0 ms entre deux actions ; sans lui, tout se fige.
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("un toast de réussite disparaît seul", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Declencheur options={{ tone: "reussite", title: "Modifications enregistrées" }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Déclencher" }));
    expect(screen.getByText("Modifications enregistrées")).toBeVisible();
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText("Modifications enregistrées")).not.toBeInTheDocument();
  });

  it("un toast avec action reste affiché", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClick = vi.fn();
    render(
      <ToastProvider>
        <Declencheur
          options={{
            tone: "erreur",
            title: "Envoi impossible",
            description: "Vérifiez votre connexion puis réessayez.",
            action: { label: "Réessayer", onClick },
          }}
        />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Déclencher" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(screen.getByText("Envoi impossible")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Réessayer" }));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.queryByText("Envoi impossible")).not.toBeInTheDocument();
  });

  it("un toast avec action peut être fermé", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <ToastProvider>
        <Declencheur options={{ tone: "erreur", title: "Envoi impossible", action: { label: "Réessayer", onClick: () => {} } }} />
      </ToastProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Déclencher" }));
    await user.click(screen.getByRole("button", { name: "Fermer la notification" }));
    expect(screen.queryByText("Envoi impossible")).not.toBeInTheDocument();
  });
});

describe("Chargement", () => {
  it("le spinner est annoncé", () => {
    render(<Spinner label="Chargement de la leçon…" />);
    expect(screen.getByRole("status", { name: "Chargement de la leçon…" })).toBeInTheDocument();
  });
});
