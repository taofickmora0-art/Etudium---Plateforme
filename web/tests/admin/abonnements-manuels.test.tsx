// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AbonnementsCompte } from "@/lib/admin/paiements/types";
import type { Formule } from "@/lib/abonnement/types";

// Attribuer et résilier un abonnement à la main, depuis la fiche d'un compte (0054). Les administrateurs agissent ; un
// modérateur voit sans boutons.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/admin/paiements/actions", () => ({
  attribuerAbonnement: vi.fn(async () => ({ ok: true })),
  resilierAbonnements: vi.fn(async () => ({ ok: true })),
  annulerAbonnement: vi.fn(async () => ({ ok: true })),
}));
const actions = await import("@/lib/admin/paiements/actions");
const { SectionAbonnement } = await import("@/components/admin/abonnements/SectionAbonnement");

const FORMULES: Formule[] = [
  { id: "f1", code: "basique", nom: "Basique", dureeMois: 3, prix: 9000, recommandee: false, active: true },
  { id: "f2", code: "standard", nom: "Standard", dureeMois: 6, prix: 15000, recommandee: true, active: true },
  { id: "f3", code: "premium", nom: "Premium", dureeMois: 12, prix: null, recommandee: false, active: true },
];
const ACTIF: AbonnementsCompte = {
  etat: { etat: "actif", formule: { code: "standard", nom: "Standard" }, fin: "2027-05-01T09:00:00Z" },
  abonnements: [
    {
      id: "a2",
      formule: { code: "basique", nom: "Basique", dureeMois: 3 },
      debut: "2027-05-01T09:00:00Z",
      fin: "2027-08-01T09:00:00Z",
      annuleLe: null,
      motifAnnulation: null,
      source: "manuel",
      moyenManuel: "especes",
      operateur: null,
      montant: 9000,
      numeroRecu: "ET-R-2026-000002",
    },
    {
      id: "a1",
      formule: { code: "standard", nom: "Standard", dureeMois: 6 },
      debut: "2026-11-01T09:00:00Z",
      fin: "2027-05-01T09:00:00Z",
      annuleLe: null,
      motifAnnulation: null,
      source: "payiz",
      moyenManuel: null,
      operateur: "mtn",
      montant: 15000,
      numeroRecu: "ET-R-2026-000001",
    },
  ],
};
const GRATUIT: AbonnementsCompte = { etat: { etat: "gratuit" }, abonnements: [] };
const afficher = (donnees = ACTIF, ecriture = true) =>
  render(<SectionAbonnement compte={{ id: "c1", nom: "Awa Kpadé" }} donnees={donnees} formules={FORMULES} ecriture={ecriture} maintenant="2026-11-01T09:00:00.000Z" />);

beforeEach(() => vi.clearAllMocks());

describe("La section « Abonnement » de la fiche", () => {
  it("l'état et chaque abonnement, avec son origine", () => {
    afficher();
    expect(screen.getByText("Standard, actif jusqu’au 1er mai 2027")).toBeInTheDocument();
    const lignes = screen.getAllByRole("listitem");
    expect(lignes[0]).toHaveTextContent("Basique");
    expect(lignes[0]).toHaveTextContent("Espèces");
    expect(lignes[0]).toHaveTextContent("Du 1er mai 2027 au 1er août 2027");
    expect(lignes[1]).toHaveTextContent("MTN Mobile Money");
    expect(within(lignes[1]).getByRole("link", { name: "Reçu ET-R-2026-000001" })).toHaveAttribute("href", "/abonnement/recus/ET-R-2026-000001");
  });

  it("compte gratuit : « Compte gratuit », pas de « Résilier »", () => {
    afficher(GRATUIT);
    expect(screen.getByText("Compte gratuit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Attribuer un abonnement" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Résilier" })).toBeNull();
  });

  it("un modérateur voit, sans boutons", () => {
    afficher(ACTIF, false);
    expect(screen.queryByRole("button", { name: "Attribuer un abonnement" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Résilier" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Annuler/ })).toBeNull();
  });
});

describe("Attribuer", () => {
  it("abonnement, moyen, montant rempli d'office avec le prix, référence", async () => {
    const user = userEvent.setup();
    afficher(GRATUIT);
    await user.click(screen.getByRole("button", { name: "Attribuer un abonnement" }));
    const fenetre = screen.getByRole("dialog", { name: "Attribuer un abonnement à Awa Kpadé" });
    expect(within(fenetre).getByRole("radio", { name: /Standard/ })).toBeChecked();
    expect(within(fenetre).getByLabelText("Montant reçu (FCFA)")).toHaveValue("15000");
    await user.click(within(fenetre).getByRole("radio", { name: /Basique/ }));
    expect(within(fenetre).getByLabelText("Montant reçu (FCFA)")).toHaveValue("9000");
    await user.click(within(fenetre).getByRole("radio", { name: "Mobile Money hors plateforme" }));
    await user.type(within(fenetre).getByLabelText("Référence (facultative)"), "MP2611.1234");
    await user.click(within(fenetre).getByRole("button", { name: "Attribuer" }));
    expect(actions.attribuerAbonnement).toHaveBeenCalledWith({ compteId: "c1", formuleId: "f1", moyen: "mobile_money", montant: "9000", reference: "MP2611.1234" });
  });

  it("le montant reçu n'accepte que des chiffres", async () => {
    const user = userEvent.setup();
    afficher(GRATUIT);
    await user.click(screen.getByRole("button", { name: "Attribuer un abonnement" }));
    const montant = within(screen.getByRole("dialog")).getByLabelText("Montant reçu (FCFA)");
    await user.clear(montant);
    await user.type(montant, "15a 0b00");
    expect(montant).toHaveValue("15000");
  });

  it("offert : pas de montant à saisir", async () => {
    const user = userEvent.setup();
    afficher(GRATUIT);
    await user.click(screen.getByRole("button", { name: "Attribuer un abonnement" }));
    const fenetre = screen.getByRole("dialog");
    await user.click(within(fenetre).getByRole("radio", { name: "Offert" }));
    expect(within(fenetre).queryByLabelText("Montant reçu (FCFA)")).toBeNull();
    await user.click(within(fenetre).getByRole("button", { name: "Attribuer" }));
    expect(actions.attribuerAbonnement).toHaveBeenCalledWith(expect.objectContaining({ moyen: "offert", montant: "0" }));
  });

  it("un refus de la base s'affiche dans la fenêtre", async () => {
    vi.mocked(actions.attribuerAbonnement).mockResolvedValueOnce({ ok: false, message: "Indiquez le montant reçu." });
    const user = userEvent.setup();
    afficher(GRATUIT);
    await user.click(screen.getByRole("button", { name: "Attribuer un abonnement" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Attribuer" }));
    expect(await within(screen.getByRole("dialog")).findByText("Indiquez le montant reçu.")).toBeInTheDocument();
  });
});

describe("Résilier", () => {
  it("avec un motif : tout l'accès s'arrête", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Résilier" }));
    const fenetre = screen.getByRole("dialog", { name: "Résilier l’abonnement de Awa Kpadé ?" });
    await user.type(within(fenetre).getByLabelText("Motif"), "Remboursé à sa demande");
    await user.click(within(fenetre).getByRole("button", { name: "Résilier" }));
    expect(actions.resilierAbonnements).toHaveBeenCalledWith("c1", "Remboursé à sa demande");
  });

  it("annuler un seul abonnement de la liste", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Annuler l’abonnement Basique" }));
    const fenetre = screen.getByRole("dialog", { name: "Annuler cet abonnement ?" });
    await user.type(within(fenetre).getByLabelText("Motif"), "Erreur de saisie");
    await user.click(within(fenetre).getByRole("button", { name: "Annuler l’abonnement" }));
    expect(actions.annulerAbonnement).toHaveBeenCalledWith("a2", "Erreur de saisie");
  });
});
