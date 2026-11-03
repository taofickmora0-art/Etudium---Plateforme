// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Recu } from "@/components/abonnement/Recu";
import { montantFcfa } from "@/lib/abonnement/regles";
import type { Recu as DonneesRecu } from "@/lib/abonnement/data";

// Le reçu imprimable (lot 2, spec §6) : une page HTML, imprimée ou enregistrée en PDF par le navigateur.

vi.mock("@/lib/abonnement/data", () => ({ lireRecu: vi.fn(async () => null) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const texte = (t: string) => t.replace(/ /g, " ");
const RECU: DonneesRecu = {
  numero: "ET-R-2026-000001",
  date: "2026-11-01T09:01:00Z",
  compte: { prenom: "Awa", nom: "Kpadé" },
  formule: { nom: "Standard", dureeMois: 6 },
  debut: "2026-11-01T09:01:00Z",
  fin: "2027-05-01T09:01:00Z",
  prixInitial: 15000,
  remise: 3000,
  code: "PROMO20",
  montant: 12000,
  // Un paiement d'avant la 0072 : le code de l'opérateur seul, sans pays.
  operateur: "mtn",
  operateurNom: null,
  pays: null,
  telephoneMasque: "+229 01 •• •• •• 00",
  moyenManuel: null,
  referenceManuelle: null,
};

describe("Le reçu", () => {
  it("tout ce qu'il faut, et l'impression", async () => {
    const imprimer = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<Recu recu={RECU} />);
    expect(screen.getByRole("heading", { level: 1, name: "Reçu de paiement" })).toBeInTheDocument();
    // Le vrai logo d'Étudium en tête, comme dans les e-mails (demande du 3 novembre 2026), et non le mot seul.
    const logo = screen.getByRole("img", { name: "Étudium" });
    expect(logo.querySelector("svg path")).not.toBeNull();
    for (const t of [
      "ET-R-2026-000001",
      "1er novembre 2026",
      "Compte : Awa Kpadé",
      "Abonnement Standard · 6 mois",
      "Du 1er novembre 2026 au 1er mai 2027",
      "Remise (PROMO20)",
      "Montant payé",
      "Moyen : MTN Mobile Money · +229 01 •• •• •• 00",
      "Étudium · Paiement traité par Payiz",
    ]) {
      expect(document.body).toHaveTextContent(t);
    }
    expect(document.body).toHaveTextContent(texte(`− ${montantFcfa(3000)}`));
    expect(document.body).toHaveTextContent(texte(montantFcfa(12000)));
    await userEvent.click(screen.getByRole("button", { name: "Imprimer ou enregistrer en PDF" }));
    expect(imprimer).toHaveBeenCalled();
  });

  it("un nouveau paiement (0072) : le nom de l'opérateur au moment du paiement, le pays et le numéro masqué", () => {
    render(<Recu recu={{ ...RECU, operateur: "celtiis", operateurNom: "Celtiis Cash", pays: "BEN", telephoneMasque: "+229 •• •• •• •• 00" }} />);
    expect(document.body).toHaveTextContent("Moyen : Celtiis Cash (Bénin) · +229 •• •• •• •• 00");
  });

  it("un payeur d'un autre pays : son opérateur et son pays", () => {
    render(<Recu recu={{ ...RECU, operateur: "togocel", operateurNom: "Mixx by Yas", pays: "TGO", telephoneMasque: "+228 •• •• •• •• 56" }} />);
    expect(document.body).toHaveTextContent("Moyen : Mixx by Yas (Togo) · +228 •• •• •• •• 56");
  });

  it("un ancien paiement dont la migration a noté le pays (Bénin)", () => {
    render(<Recu recu={{ ...RECU, operateur: "moov", pays: "BEN" }} />);
    expect(document.body).toHaveTextContent("Moyen : Moov Money (Bénin) · +229 01 •• •• •• 00");
  });

  it("payé hors plateforme : le moyen et la référence (0054)", () => {
    render(<Recu recu={{ ...RECU, operateur: null, telephoneMasque: null, moyenManuel: "mobile_money", referenceManuelle: "MP2611.1234" }} />);
    expect(document.body).toHaveTextContent("Moyen : Mobile Money hors plateforme · réf. MP2611.1234");
  });

  it("abonnement offert : « Offert », sans numéro", () => {
    render(<Recu recu={{ ...RECU, montant: 0, remise: 15000, code: "OFFERT", operateur: null, telephoneMasque: null }} />);
    expect(document.body).toHaveTextContent("Moyen : Offert");
  });

  it("un numéro inconnu : page introuvable", async () => {
    const { ContenuRecu } = await import("@/components/abonnement/ContenuRecu");
    await expect(ContenuRecu({ numero: "ET-R-2026-999999" })).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
