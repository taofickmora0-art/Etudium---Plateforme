// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import { montantFcfa } from "@/lib/abonnement/regles";
import type { EtapePaiement, Formule } from "@/lib/abonnement/types";
import { carteSql, PAIEMENT_ID } from "./fixtures";

// L'écran de souscription (lot 2, spec §6) : l'abonnement, le paiement Mobile Money (numéro, opérateur, code promo,
// récapitulatif), l'attente de la validation sur le téléphone (suivie toutes les 3 s, 3 minutes au plus) et le résultat.

vi.mock("@/lib/abonnement/actions", () => ({ essayerCode: vi.fn(), payer: vi.fn(), suivrePaiement: vi.fn(), reessayer: vi.fn() }));
const actions = await import("@/lib/abonnement/actions");
const { Souscription } = await import("@/components/abonnement/Souscription");

const essayerCode = vi.mocked(actions.essayerCode);
const payer = vi.mocked(actions.payer);
const suivre = vi.mocked(actions.suivrePaiement);
const reessayer = vi.mocked(actions.reessayer);

const MAINTENANT = "2026-11-01T09:00:00.000Z";
const FORMULES: Formule[] = [
  { id: "f-basique", code: "basique", nom: "Basique", dureeMois: 3, prix: 9000, recommandee: false, active: true },
  { id: "f-standard", code: "standard", nom: "Standard", dureeMois: 6, prix: 15000, recommandee: true, active: true },
  { id: "f-premium", code: "premium", nom: "Premium", dureeMois: 12, prix: null, recommandee: false, active: true },
];
// getByText compare le texte de la page, espaces normalisés, au texte demandé tel quel : l'espace fine de `Intl` (U+202F)
// devient une espace ordinaire.
const texte = (t: string) => t.replace(/ /g, " ");
const carte = (champs: Record<string, unknown> = {}) => versCartePaiement(carteSql({ telephone_masque: "+229 01 •• •• •• 00", ...champs }));
const attente = (): EtapePaiement => ({ etat: "attente", paiement: carte({ payiz_id: "pay_1" }), finAttente: new Date(Date.now() + 180_000).toISOString() });
const reussi = (): EtapePaiement => ({
  etat: "reussi",
  paiement: carte({ statut: "reussi", numero_recu: "ET-R-2026-000001", abonnement: { debut: MAINTENANT, fin: "2027-05-01T09:00:00Z" } }),
});

const afficher = (props: Partial<Parameters<typeof Souscription>[0]> = {}) =>
  render(<Souscription formules={FORMULES} abonnement={{ etat: "gratuit" }} ouverts initiale={null} maintenant={MAINTENANT} {...props} />);

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(MAINTENANT));
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  for (const f of [essayerCode, payer, suivre, reessayer]) f.mockReset();
});
afterEach(() => vi.useRealTimers());

const allerAuPaiement = async (numero = "01 42 00 00 00") => {
  await user.click(screen.getByRole("button", { name: "Continuer" }));
  if (numero) await user.type(screen.getByLabelText("Numéro Mobile Money"), numero);
};
const avancer = (ms: number) => act(async () => {
  await vi.advanceTimersByTimeAsync(ms);
});

describe("Choisir l'abonnement", () => {
  it("trois abonnements, Standard recommandé et choisi", () => {
    afficher();
    expect(screen.getByRole("radio", { name: /Standard/ })).toBeChecked();
    expect(screen.getByText("Recommandé")).toBeInTheDocument();
    expect(screen.getByText(texte(montantFcfa(9000)))).toBeInTheDocument();
    expect(screen.getByText(texte(montantFcfa(15000)))).toBeInTheDocument();
    expect(screen.getByText("1 an")).toBeInTheDocument();
  });

  it("un abonnement sans prix ne se choisit pas", () => {
    afficher({ initiale: "premium" });
    expect(screen.getByText("Prix annoncés au lancement")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Premium/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Standard/ })).toBeChecked();
  });

  it("l'abonnement demandé dans l'adresse est choisi d'avance", () => {
    afficher({ initiale: "basique" });
    expect(screen.getByRole("radio", { name: /Basique/ })).toBeChecked();
  });
});

describe("Le paiement", () => {
  it("récapitulatif : dates calculées, code appliqué, total", async () => {
    essayerCode.mockResolvedValue({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000 });
    afficher();
    await allerAuPaiement();
    expect(screen.getByText("6 mois · du 1er novembre 2026 au 1er mai 2027")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Code promo (facultatif)"), "promo20");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(essayerCode).toHaveBeenCalledWith("f-standard", "promo20");
    expect(screen.getByText(texte(`Code appliqué : − ${montantFcfa(3000)} sur ce paiement.`))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(12000)}` })).toBeEnabled();
  });

  it("un code refusé affiche son message", async () => {
    essayerCode.mockResolvedValue({ ok: false, message: "Ce code a expiré." });
    afficher();
    await allerAuPaiement();
    await user.type(screen.getByLabelText("Code promo (facultatif)"), "VIEUX");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.getByText("Ce code a expiré.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` })).toBeInTheDocument();
  });

  it("le numéro propose l'opérateur", async () => {
    afficher();
    await allerAuPaiement("01 55 00 00 00");
    expect(screen.getByRole("radio", { name: /Moov Money/ })).toBeChecked();
  });

  it("paiements fermés : message et bouton désactivé", async () => {
    afficher({ ouverts: false });
    await allerAuPaiement();
    expect(screen.getByText("Les paiements ouvrent bientôt.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` })).toBeDisabled();
  });

  it("une erreur de l'action s'affiche sous le bouton", async () => {
    payer.mockResolvedValue({ etat: "erreur", message: "Choisissez votre opérateur, MTN ou Moov." });
    afficher();
    await allerAuPaiement("01 40 00 00 00");
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez votre opérateur, MTN ou Moov.");
  });
});

describe("L'attente et le résultat", () => {
  it("attente puis succès : numéro masqué, compte à rebours, reçu", async () => {
    payer.mockResolvedValue(attente());
    suivre.mockResolvedValueOnce(attente()).mockResolvedValueOnce(attente()).mockResolvedValue(reussi());
    afficher();
    await allerAuPaiement();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "", telephone: "01 42 00 00 00", operateur: "mtn" });
    const fenetre = screen.getByRole("dialog", { name: "Confirmez sur votre téléphone" });
    expect(fenetre).toHaveTextContent("+229 01 •• •• •• 00");
    expect(fenetre).toHaveTextContent("En attente de votre confirmation…");
    expect(fenetre).toHaveTextContent("3:00");
    await avancer(3000);
    expect(screen.getByRole("dialog")).toHaveTextContent("2:57");
    await avancer(6000);
    expect(suivre).toHaveBeenCalledTimes(3);
    expect(suivre).toHaveBeenCalledWith(PAIEMENT_ID);
    const succes = screen.getByRole("dialog", { name: "Paiement confirmé" });
    expect(succes).toHaveTextContent("Votre abonnement Standard est actif jusqu’au 1er mai 2027.");
    expect(within(succes).getByRole("link", { name: "Voir le reçu" })).toHaveAttribute("href", "/abonnement/recus/ET-R-2026-000001");
    expect(within(succes).getByRole("link", { name: "Commencer" })).toHaveAttribute("href", "/parcours");
  });

  it("échec : motif clair, Réessayer relance le même paiement", async () => {
    payer.mockResolvedValue(attente());
    suivre.mockResolvedValue({
      etat: "echoue",
      paiement: carte({ statut: "echoue", payiz_id: "pay_1", motif_echec: "insufficient_funds" }),
      message: "Votre solde Mobile Money est insuffisant. Rechargez puis réessayez.",
    });
    reessayer.mockResolvedValue(attente());
    afficher();
    await allerAuPaiement();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    await avancer(3000);
    const echec = await screen.findByRole("dialog", { name: "Le paiement n’a pas abouti" });
    expect(echec).toHaveTextContent("Votre solde Mobile Money est insuffisant. Rechargez puis réessayez.");
    expect(echec).toHaveTextContent("Aucun montant n’a été débité.");
    await user.click(within(echec).getByRole("button", { name: "Réessayer" }));
    expect(reessayer).toHaveBeenCalledWith({ paiementId: PAIEMENT_ID, telephone: "01 42 00 00 00", operateur: "mtn" });
    expect(await screen.findByRole("dialog", { name: "Confirmez sur votre téléphone" })).toBeInTheDocument();
  });

  it("3 minutes sans réponse : « La demande n’a pas été validée à temps. »", async () => {
    payer.mockResolvedValue(attente());
    suivre.mockImplementation(async () => attente());
    afficher();
    await allerAuPaiement();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    await avancer(181_000);
    const fenetre = screen.getByRole("dialog", { name: "Le paiement n’a pas abouti" });
    expect(fenetre).toHaveTextContent("La demande n’a pas été validée à temps.");
    // L'état chez Payiz est inconnu : on ne promet rien sur le débit (revue finale).
    expect(fenetre).not.toHaveTextContent("Aucun montant n’a été débité.");
    expect(fenetre).toHaveTextContent("Si le montant a été débité, votre abonnement s’ouvrira automatiquement.");
  });

  it("demande expirée : Recommencer relance un paiement", async () => {
    payer.mockResolvedValueOnce({ etat: "expire", paiement: carte({ statut: "expire" }) }).mockResolvedValueOnce(attente());
    afficher();
    await allerAuPaiement();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    const expire = await screen.findByRole("dialog", { name: "La demande a expiré" });
    await user.click(within(expire).getByRole("button", { name: "Recommencer" }));
    expect(payer).toHaveBeenCalledTimes(2);
  });

  it("100 % : abonnement offert sans numéro", async () => {
    essayerCode.mockResolvedValue({ ok: true, prixInitial: 15000, remise: 15000, montant: 0 });
    payer.mockResolvedValue(reussi());
    afficher();
    await allerAuPaiement("");
    await user.type(screen.getByLabelText("Code promo (facultatif)"), "OFFERT");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.queryByLabelText("Numéro Mobile Money")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Activer mon abonnement offert" }));
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "OFFERT", telephone: "", operateur: null });
    expect(screen.getByRole("dialog", { name: "Paiement confirmé" })).toBeInTheDocument();
  });
});
