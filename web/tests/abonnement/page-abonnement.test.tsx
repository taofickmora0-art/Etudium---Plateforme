// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PageAbonnement } from "@/components/abonnement/PageAbonnement";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import { montantFcfa } from "@/lib/abonnement/regles";
import type { EtatAbonnement } from "@/lib/abonnement/types";
import { carteSql } from "./fixtures";

// « Mon abonnement » (lot 2, spec §6) : l'état du compte, « S'abonner » / « Prolonger » / « Renouveler », l'historique
// des paiements et leurs reçus. Avant l'affichage, les paiements restés en attente sont relus chez Payiz.

const lectures: string[] = [];
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/lib/paiements/synchroniser", () => ({ resynchroniserEnAttente: vi.fn(async () => void lectures.push("resynchroniser")) }));
vi.mock("@/lib/abonnement/data", () => ({
  lireAbonnement: vi.fn(async () => (lectures.push("abonnement"), { etat: "gratuit" })),
  lirePaiements: vi.fn(async () => (lectures.push("paiements"), [])),
  lireFormules: vi.fn(async () => (lectures.push("formules"), [])),
  paiementsOuverts: vi.fn(async () => (lectures.push("ouverts"), true)),
}));

const MAINTENANT = new Date("2026-11-01T09:00:00Z");
const texte = (t: string) => t.replace(/ /g, " ");
const afficher = (abonnement: EtatAbonnement, paiements = [] as ReturnType<typeof versCartePaiement>[]) =>
  render(<PageAbonnement abonnement={abonnement} paiements={paiements} maintenant={MAINTENANT} />);
const STANDARD = { code: "standard" as const, nom: "Standard" };

describe("L'état du compte", () => {
  it("compte gratuit : S'abonner", () => {
    afficher({ etat: "gratuit" });
    expect(screen.getByRole("heading", { level: 1, name: "Mon abonnement" })).toBeInTheDocument();
    expect(screen.getByText("Compte gratuit")).toBeInTheDocument();
    expect(screen.getByText("Les formations gratuites, votre progression et vos certificats.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "S’abonner" })).toHaveAttribute("href", "/abonnement/souscrire");
  });

  it("abonnement actif : jusqu'à sa fin, Prolonger", () => {
    afficher({ etat: "actif", formule: STANDARD, fin: "2027-03-14T09:00:00Z" });
    expect(screen.getByText("Abonnement Standard")).toBeInTheDocument();
    expect(screen.getByText("Actif")).toBeInTheDocument();
    expect(screen.getByText("Jusqu’au 14 mars 2027")).toBeInTheDocument();
    expect(screen.getByText("Renouvellement manuel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prolonger" })).toHaveAttribute("href", "/abonnement/souscrire");
  });

  it("7 jours ou moins : « Expire dans 5 jours »", () => {
    afficher({ etat: "actif", formule: STANDARD, fin: "2026-11-06T08:00:00Z" });
    expect(screen.getByText("Expire dans 5 jours")).toBeInTheDocument();
    expect(screen.queryByText("Actif")).not.toBeInTheDocument();
  });

  it("abonnement expiré : Renouveler", () => {
    afficher({ etat: "expire", formule: STANDARD, fin: "2026-10-14T09:00:00Z" });
    expect(screen.getByText("Expiré")).toBeInTheDocument();
    expect(screen.getByText("Expiré le 14 octobre 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renouveler" })).toHaveAttribute("href", "/abonnement/souscrire");
  });
});

describe("L'historique des paiements", () => {
  it("chaque paiement, et le reçu des paiements réussis", () => {
    afficher({ etat: "gratuit" }, [
      versCartePaiement(carteSql({ statut: "reussi", operateur: "mtn", numero_recu: "ET-R-2026-000001", cree_le: "2026-11-01T09:00:00Z" })),
      versCartePaiement(carteSql({ id: "p2", statut: "echoue", operateur: "moov", payiz_id: "pay_2", cree_le: "2026-10-30T09:00:00Z" })),
      versCartePaiement(carteSql({ id: "p3", statut: "reussi", montant: 0, remise: 15000, numero_recu: "ET-R-2026-000002", cree_le: "2026-10-01T09:00:00Z" })),
    ]);
    const tableau = screen.getByRole("table");
    expect(within(tableau).getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Date", "Abonnement", "Moyen", "Montant", "Statut", "Reçu"]);
    const [, premiere, deuxieme, troisieme] = within(tableau).getAllByRole("row");
    expect(premiere).toHaveTextContent("01/11/2026");
    expect(premiere).toHaveTextContent("Standard · 6 mois");
    expect(premiere).toHaveTextContent("MTN Mobile Money");
    expect(premiere).toHaveTextContent(texte(montantFcfa(12000)));
    expect(premiere).toHaveTextContent("Réussi");
    expect(within(premiere).getByRole("link", { name: "Voir le reçu du 01/11/2026" })).toHaveAttribute("href", "/abonnement/recus/ET-R-2026-000001");
    expect(deuxieme).toHaveTextContent("Moov Money");
    expect(deuxieme).toHaveTextContent("Échoué");
    expect(within(deuxieme).queryByRole("link")).toBeNull();
    expect(troisieme).toHaveTextContent("Offert");
  });

  it("sans paiement : un message", () => {
    afficher({ etat: "gratuit" });
    expect(screen.getByText("Aucun paiement pour le moment.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("La page serveur", () => {
  it("relit d'abord les paiements en attente chez Payiz", async () => {
    const { ContenuAbonnement } = await import("@/components/abonnement/ContenuAbonnement");
    lectures.length = 0;
    await ContenuAbonnement();
    expect(lectures[0]).toBe("resynchroniser");
    expect([...lectures].sort()).toEqual(["abonnement", "paiements", "resynchroniser"]);
  });

  it("la souscription aussi : un paiement réussi pendant l'absence ne se paie pas deux fois (revue finale)", async () => {
    const { ContenuSouscription } = await import("@/components/abonnement/ContenuSouscription");
    lectures.length = 0;
    await ContenuSouscription({ formule: "standard" });
    expect(lectures[0]).toBe("resynchroniser");
    expect(lectures).toContain("abonnement");
  });
});
