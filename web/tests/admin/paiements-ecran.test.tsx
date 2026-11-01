// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodePromo, EtatReglage, PagePaiements as Page, ResumePaiements } from "@/lib/admin/paiements/data";
import type { Formule } from "@/lib/abonnement/types";

// L'écran « Abonnements et paiements » du back-office (lot 2, spec §6) : le réglage des paiements, les paiements et
// leur détail, les prix des abonnements, les codes promo. Un modérateur voit tout sans pouvoir rien changer.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/admin/paiements/actions", () => ({
  activerPaiements: vi.fn(async () => ({ ok: true })),
  desactiverPaiements: vi.fn(async () => ({ ok: true })),
  reglerFormule: vi.fn(async () => ({ ok: true })),
  enregistrerCodePromo: vi.fn(async () => ({ ok: true })),
  annulerAbonnement: vi.fn(async () => ({ ok: true })),
  chargerPaiements: vi.fn(),
  chargerPaiement: vi.fn(),
}));
vi.mock("@/lib/utilisateurs/actions", () => ({ chercherComptes: vi.fn() }));
const actions = await import("@/lib/admin/paiements/actions");
const { chercherComptes } = await import("@/lib/utilisateurs/actions");
const { PagePaiements } = await import("@/components/admin/paiements/PagePaiements");

const texte = (t: string) => t.replace(/ /g, " ");
const RESUME: ResumePaiements = { revenusMois: 45000, reussisMois: 3, echouesMois: 1, abonnesActifs: 7 };
const FORMULES: Formule[] = [
  { id: "f1", code: "basique", nom: "Basique", dureeMois: 3, prix: 9000, recommandee: false, active: true },
  { id: "f2", code: "standard", nom: "Standard", dureeMois: 6, prix: 15000, recommandee: true, active: true },
  { id: "f3", code: "premium", nom: "Premium", dureeMois: 12, prix: null, recommandee: false, active: true },
];
const CODES: CodePromo[] = [
  { id: "c1", code: "PROMO20", type: "pourcentage", valeur: 20, debut: null, fin: null, limite: 50, actif: true, utilisations: 3, creeLe: "2026-11-01T09:00:00Z" },
];
const PAIEMENTS: Page = {
  total: 1,
  lignes: [
    {
      id: "p1",
      creeLe: "2026-11-01T09:00:00Z",
      compte: { id: "c", prenom: "Awa", nom: "Kpadé", email: "awa@exemple.com" },
      formule: { code: "standard", nom: "Standard", dureeMois: 6 },
      montant: 12000,
      statut: "reussi",
      operateur: "mtn",
      telephoneMasque: "+229 01 •• •• •• 00",
      numeroRecu: "ET-R-2026-000001",
      source: "payiz",
      moyenManuel: null,
    },
  ],
};
const ACTIF: EtatReglage = { ouverts: true, jeton: "reconnu", cle: "test", webhook: false };
const afficher = (props: Partial<Parameters<typeof PagePaiements>[0]> = {}) =>
  render(<PagePaiements resume={RESUME} etat={ACTIF} formules={FORMULES} codes={CODES} paiements={PAIEMENTS} ecriture {...props} />);

beforeEach(() => vi.clearAllMocks());

describe("Le réglage « Paiements activés »", () => {
  it("activés, jeton reconnu : le mode de la clé, et « Désactiver »", () => {
    afficher();
    expect(screen.getByText("Paiements activés")).toBeInTheDocument();
    expect(screen.getByText("Clé Payiz : mode test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Désactiver les paiements" })).toBeInTheDocument();
    expect(screen.getByText("Notifications Payiz : à brancher une fois le site en ligne.")).toBeInTheDocument();
  });

  it("désactivés, sans jeton : bouton bloqué et le guide", () => {
    afficher({ etat: { ouverts: false, jeton: "absent", cle: "absente", webhook: false } });
    expect(screen.getByText("Paiements désactivés")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activer les paiements" })).toBeDisabled();
    expect(screen.getByText(/Ajoutez PAYIZ_CLE_SECRETE et PAIEMENT_JETON dans web\/\.env\.local/)).toBeInTheDocument();
  });

  it("jeton qui ne correspond plus : l'alerte et « Réactiver »", async () => {
    afficher({ etat: { ...ACTIF, jeton: "non_reconnu" } });
    expect(screen.getByText(/Le jeton du serveur ne correspond plus à celui enregistré/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Réactiver" }));
    expect(actions.activerPaiements).toHaveBeenCalled();
  });
});

describe("Les chiffres et les onglets", () => {
  it("les quatre chiffres du mois", () => {
    afficher();
    expect(screen.getByText("Revenus du mois")).toBeInTheDocument();
    expect(screen.getByText(texte("45 000 FCFA"))).toBeInTheDocument();
    expect(screen.getByText("Abonnés actifs")).toBeInTheDocument();
  });

  it("Paiements : la ligne et son détail, avec « Annuler l’abonnement »", async () => {
    vi.mocked(actions.chargerPaiement).mockResolvedValue({
      ok: true,
      detail: {
        id: "p1",
        statut: "reussi",
        formule: { code: "standard", nom: "Standard", dureeMois: 6 },
        prixInitial: 15000,
        remise: 3000,
        montant: 12000,
        code: "PROMO20",
        operateur: "mtn",
        telephoneMasque: "+229 01 •• •• •• 00",
        motifEchec: null,
        numeroRecu: "ET-R-2026-000001",
        payizId: "pay_1",
        source: "payiz",
        moyenManuel: null,
        referenceManuelle: null,
        creeLe: "2026-11-01T09:00:00Z",
        essaiLe: "2026-11-01T09:00:00Z",
        confirmeLe: "2026-11-01T09:01:00Z",
        abonnement: { debut: "2026-11-01T09:01:00Z", fin: "2099-05-01T09:01:00Z" },
        compte: { id: "c", prenom: "Awa", nom: "Kpadé", email: "awa@exemple.com" },
        abonnementEquipe: { id: "a1", debut: "2026-11-01T09:01:00Z", fin: "2099-05-01T09:01:00Z", annuleLe: null, motifAnnulation: null },
      },
    });
    afficher();
    const ligne = screen.getByRole("row", { name: /Awa Kpadé/ });
    expect(ligne).toHaveTextContent("Standard · 6 mois");
    expect(ligne).toHaveTextContent("Réussi");
    await userEvent.click(within(ligne).getByRole("button", { name: "Voir le détail" }));
    const detail = await screen.findByRole("dialog", { name: "Paiement ET-R-2026-000001" });
    expect(detail).toHaveTextContent("awa@exemple.com");
    expect(within(detail).getByRole("link", { name: "Voir le reçu" })).toHaveAttribute("href", "/abonnement/recus/ET-R-2026-000001");
    expect(within(detail).getByRole("button", { name: "Annuler l’abonnement" })).toBeInTheDocument();
  });

  it("Abonnements : le prix, recommandé, proposé", async () => {
    afficher();
    await userEvent.click(screen.getByRole("tab", { name: "Abonnements" }));
    expect(screen.getAllByLabelText("Prix (FCFA)")).toHaveLength(3);
    expect(screen.getAllByRole("button", { name: "Enregistrer" })).toHaveLength(3);
  });

  it("Codes promo : remise, utilisations, état", async () => {
    afficher();
    await userEvent.click(screen.getByRole("tab", { name: "Codes promo" }));
    const ligne = screen.getByRole("row", { name: /PROMO20/ });
    expect(ligne).toHaveTextContent("20 %");
    expect(ligne).toHaveTextContent("3 / 50");
    expect(ligne).toHaveTextContent("Actif");
    expect(screen.getByRole("button", { name: "Nouveau code" })).toBeInTheDocument();
  });
});

describe("Attribuer un abonnement depuis la page des paiements (0054)", () => {
  it("chercher le compte, puis la fenêtre d'attribution", async () => {
    vi.mocked(chercherComptes).mockResolvedValue({
      ok: true,
      page: {
        total: 1,
        comptes: [{ id: "c1", prenom: "Awa", nom: "Kpadé", email: "awa@exemple.com", roles: ["etudiant"], inscritLe: "2026-10-01T09:00:00Z", derniereConnexion: null, suspendu: false }],
      },
    });
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Attribuer un abonnement" }));
    const recherche = screen.getByRole("dialog", { name: "Attribuer un abonnement" });
    await user.type(within(recherche).getByLabelText("Compte (nom ou adresse e-mail)"), "awa");
    await user.click(within(recherche).getByRole("button", { name: "Chercher" }));
    expect(chercherComptes).toHaveBeenCalledWith("awa", "etudiants", 1);
    await user.click(await within(recherche).findByRole("button", { name: /Awa Kpadé/ }));
    expect(await screen.findByRole("dialog", { name: "Attribuer un abonnement à Awa Kpadé" })).toBeInTheDocument();
  });

  it("un modérateur n'a pas le bouton", () => {
    afficher({ ecriture: false });
    expect(screen.queryByRole("button", { name: "Attribuer un abonnement" })).toBeNull();
  });
});

describe("Les champs de montant n'acceptent que des chiffres", () => {
  it("valeur et limite d'un code promo ; prix d'un abonnement", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("tab", { name: "Codes promo" }));
    await user.click(screen.getByRole("button", { name: "Nouveau code" }));
    const fenetre = screen.getByRole("dialog", { name: "Nouveau code promo" });
    await user.type(within(fenetre).getByLabelText("Valeur (%)"), "2a0 b");
    expect(within(fenetre).getByLabelText("Valeur (%)")).toHaveValue("20");
    await user.type(within(fenetre).getByLabelText("Limite d’utilisations (facultatif)"), "cinq5");
    expect(within(fenetre).getByLabelText("Limite d’utilisations (facultatif)")).toHaveValue("5");
    await user.click(within(fenetre).getByRole("button", { name: "Annuler" }));
    await user.click(screen.getByRole("tab", { name: "Abonnements" }));
    const [prix] = screen.getAllByLabelText("Prix (FCFA)");
    await user.clear(prix);
    await user.type(prix, "1x2 000");
    expect(prix).toHaveValue("12000");
  });
});

describe("Un modérateur", () => {
  it("voit tout, sans aucun bouton d'écriture", async () => {
    afficher({ ecriture: false });
    expect(screen.queryByRole("button", { name: "Désactiver les paiements" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Abonnements" }));
    expect(screen.queryByRole("button", { name: "Enregistrer" })).toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Codes promo" }));
    expect(screen.queryByRole("button", { name: "Nouveau code" })).toBeNull();
    expect(screen.getByRole("row", { name: /PROMO20/ })).toBeInTheDocument();
  });
});
