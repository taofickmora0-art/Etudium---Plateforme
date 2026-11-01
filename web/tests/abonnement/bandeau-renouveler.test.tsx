// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { BandeauRenouveler } from "@/components/abonnement/BandeauRenouveler";
import type { EtatAbonnement } from "@/lib/abonnement/types";

// Le bandeau « Renouveler » en tête de l'Accueil (lot 2, spec §6 ; NdAccueilRenouvellement) : 7 jours avant la fin, et
// pendant 30 jours après l'expiration. « Plus tard » le masque jusqu'au lendemain.

const MAINTENANT = "2026-11-01T09:00:00.000Z";
const STANDARD = { code: "standard" as const, nom: "Standard" };
const jours = (n: number) => new Date(Date.parse(MAINTENANT) + n * 86_400_000).toISOString();
const afficher = (abonnement: EtatAbonnement, maintenant = MAINTENANT) => render(<BandeauRenouveler abonnement={abonnement} maintenant={maintenant} />);

beforeEach(() => localStorage.clear());

describe("Le bandeau « Renouveler »", () => {
  it("5 jours avant la fin : « se termine dans 5 jours », Prolonger", () => {
    afficher({ etat: "actif", formule: STANDARD, fin: jours(4.9) });
    expect(screen.getByText("Votre abonnement Standard se termine dans 5 jours.")).toBeInTheDocument();
    expect(screen.getByText("Prolongez-le pour garder l’accès à tout. Rien ne sera supprimé.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prolonger" })).toHaveAttribute("href", "/abonnement/souscrire");
  });

  it("la veille : « se termine demain »", () => {
    afficher({ etat: "actif", formule: STANDARD, fin: jours(0.5) });
    expect(screen.getByText("Votre abonnement Standard se termine demain.")).toBeInTheDocument();
  });

  it("expiré : la date, Renouveler", () => {
    afficher({ etat: "expire", formule: STANDARD, fin: "2026-10-14T09:00:00.000Z" });
    expect(screen.getByText("Votre abonnement Standard a expiré le 14 octobre 2026.")).toBeInTheDocument();
    expect(screen.getByText("Renouvelez-le pour rouvrir vos formations. Rien n’a été supprimé.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renouveler" })).toHaveAttribute("href", "/abonnement/souscrire");
  });

  it("absent : compte gratuit, fin lointaine, expiration ancienne", () => {
    for (const abonnement of [
      { etat: "gratuit" } as const,
      { etat: "actif" as const, formule: STANDARD, fin: jours(10) },
      { etat: "expire" as const, formule: STANDARD, fin: jours(-31) },
    ]) {
      const { container, unmount } = afficher(abonnement);
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
  });

  it("« Plus tard » le masque jusqu'au lendemain", async () => {
    const abonnement = { etat: "actif" as const, formule: STANDARD, fin: jours(3) };
    const { container, unmount } = afficher(abonnement);
    await userEvent.click(screen.getByRole("button", { name: "Plus tard" }));
    expect(container).toBeEmptyDOMElement();
    unmount();
    expect(afficher(abonnement).container).toBeEmptyDOMElement();
    expect(afficher(abonnement, jours(1)).container).not.toBeEmptyDOMElement();
  });
});
