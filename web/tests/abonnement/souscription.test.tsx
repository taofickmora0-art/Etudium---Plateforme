// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { versCartePaiement } from "@/lib/abonnement/conversion";
import { montantFcfa } from "@/lib/abonnement/regles";
import type { EtapePaiement, Formule, MoyensDePaiement, OperateurPaiement } from "@/lib/abonnement/types";
import { MOYENS_REPLI } from "@/lib/paiements/regles";
import { choisirDansListe, optionsDeLaListe } from "../utilitaires/listes";
import { carteSql, PAIEMENT_ID } from "./fixtures";

// L'écran de souscription (lot 2, spec §6) : l'abonnement, le paiement Mobile Money (pays, numéro, opérateur, code promo,
// récapitulatif), l'attente de la validation sur le téléphone (suivie toutes les 3 s, 3 minutes au plus) et le résultat.
// Les pays et les opérateurs viennent de Payiz depuis le 3 novembre 2026.

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

const operateur = (code: string, nom: string, champs: Partial<OperateurPaiement> = {}): OperateurPaiement => ({
  code,
  nom,
  logo: `https://cdn.payiz.app/operateurs/${code}.png`,
  prefixes: [],
  devise: "XOF",
  montantAPayer: 15000,
  minimum: 1000,
  maximum: 2_000_000,
  ...champs,
});
/** Les moyens de Payiz pour 15 000 FCFA : le Bénin avec Celtiis, le Ghana (en cedis), le Togo. */
const MOYENS: MoyensDePaiement = {
  repli: false,
  pays: [
    {
      code: "BEN",
      nom: "Bénin",
      indicatif: "+229",
      operateurs: [
        operateur("mtn", "MTN Mobile Money", { prefixes: ["0142", "0197"] }),
        operateur("moov", "Moov Money", { prefixes: ["0155"] }),
        operateur("celtiis", "Celtiis Cash", { prefixes: ["0143"], logo: null }),
      ],
    },
    { code: "GHA", nom: "Ghana", indicatif: "+233", operateurs: [operateur("mtn", "MTN MoMo", { devise: "GHS", montantAPayer: 32150 })] },
    {
      code: "TGO",
      nom: "Togo",
      indicatif: "+228",
      operateurs: [operateur("togocel", "Mixx by Yas", { prefixes: ["90"] }), operateur("moov", "Moov Africa", { prefixes: ["96"] })],
    },
  ],
};

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

// Un seul écran (demande du 1er novembre 2026) : les abonnements et le paiement sont visibles ensemble.
const allerAuPaiement = async (numero = "01 42 00 00 00") => {
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
    // Le prix est dans chaque carte (le récapitulatif, visible sur le même écran, le répète).
    expect(within(screen.getByRole("radio", { name: /Basique/ })).getByText(texte(montantFcfa(9000)))).toBeInTheDocument();
    expect(within(screen.getByRole("radio", { name: /Standard/ })).getByText(texte(montantFcfa(15000)))).toBeInTheDocument();
    expect(screen.getByText("1 an")).toBeInTheDocument();
  });

  it("un abonnement sans prix ne se choisit pas", () => {
    afficher({ initiale: "premium" });
    expect(screen.getByText("Prix annoncés au lancement")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Premium/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Standard/ })).toBeChecked();
  });

  it("tout sur un seul écran : les abonnements et le paiement, sans « Continuer »", () => {
    afficher();
    expect(screen.queryByRole("button", { name: "Continuer" })).toBeNull();
    expect(screen.getByLabelText("Numéro Mobile Money")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` })).toBeInTheDocument();
  });

  it("sans en-tête quand elle est posée dans « Mon abonnement »", () => {
    afficher({ enTete: false });
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
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

  it("un code d'autres abonnements (0073) : son message, sans remise", async () => {
    essayerCode.mockResolvedValue({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Standard.", autreAbonnement: true });
    afficher();
    await user.type(screen.getByLabelText("Code promo (facultatif)"), "BASIQUE10");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.getByText("Ce code ne s’applique pas à l’abonnement Standard.")).toBeInTheDocument();
    expect(screen.queryByText(/Code appliqué/)).toBeNull();
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
    payer.mockResolvedValue({ etat: "erreur", message: "Le paiement n’est pas proposé dans ce pays pour le moment. Choisissez un autre pays." });
    afficher();
    await allerAuPaiement("01 40 00 00 00");
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(screen.getByRole("alert")).toHaveTextContent("Le paiement n’est pas proposé dans ce pays pour le moment. Choisissez un autre pays.");
  });
});

// Un code promo ne vaut que pour les abonnements choisis par l'équipe (0073) : changer d'abonnement revérifie le code
// appliqué, et jamais une remise ne s'affiche pour un abonnement où elle ne vaut pas.
describe("Changer d'abonnement après un code", () => {
  const appliquer = async (code = "promo20") => {
    await user.type(screen.getByLabelText("Code promo (facultatif)"), code);
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
  };

  it("le code ne vaut pas pour le nouvel abonnement : la remise est retirée, avec le message", async () => {
    essayerCode.mockResolvedValueOnce({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000 });
    essayerCode.mockResolvedValueOnce({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Basique.", autreAbonnement: true });
    afficher();
    await appliquer();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(12000)}` })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Basique/ }));
    expect(essayerCode).toHaveBeenLastCalledWith("f-basique", "promo20");
    expect(await screen.findByText("Ce code ne s’applique pas à l’abonnement Basique.")).toBeInTheDocument();
    expect(screen.queryByText(/Code appliqué/)).toBeNull();
    expect(screen.queryByText("Code promo (PROMO20)")).toBeNull();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(9000)}` })).toBeInTheDocument();
  });

  it("le code vaut aussi pour le nouvel abonnement : la remise est recalculée", async () => {
    essayerCode.mockResolvedValueOnce({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000 });
    essayerCode.mockResolvedValueOnce({ ok: true, prixInitial: 9000, remise: 1800, montant: 7200 });
    afficher();
    await appliquer();
    await user.click(screen.getByRole("radio", { name: /Basique/ }));
    expect(await screen.findByRole("button", { name: `Payer ${montantFcfa(7200)}` })).toBeInTheDocument();
    expect(screen.getByText(texte(`Code appliqué : − ${montantFcfa(1800)} sur ce paiement.`))).toBeInTheDocument();
  });

  it("pendant la vérification : aucune remise affichée, et « Payer » attend", async () => {
    let repondre: (r: Awaited<ReturnType<typeof essayerCode>>) => void = () => {};
    essayerCode.mockResolvedValueOnce({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000 });
    essayerCode.mockImplementationOnce(() => new Promise((ok) => (repondre = ok)));
    afficher();
    await appliquer();
    await user.click(screen.getByRole("radio", { name: /Basique/ }));
    expect(screen.queryByText(/Code appliqué/)).toBeNull();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(9000)}` })).toBeDisabled();
    await act(async () => repondre({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Basique.", autreAbonnement: true }));
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(9000)}` })).toBeEnabled();
  });

  it("un code refusé pour cet abonnement est réessayé sur le nouveau", async () => {
    essayerCode.mockResolvedValueOnce({ ok: false, message: "Ce code ne s’applique pas à l’abonnement Standard.", autreAbonnement: true });
    essayerCode.mockResolvedValueOnce({ ok: true, prixInitial: 9000, remise: 900, montant: 8100 });
    afficher();
    await appliquer("BASIQUE10");
    await user.click(screen.getByRole("radio", { name: /Basique/ }));
    expect(essayerCode).toHaveBeenLastCalledWith("f-basique", "BASIQUE10");
    expect(await screen.findByRole("button", { name: `Payer ${montantFcfa(8100)}` })).toBeInTheDocument();
    expect(screen.queryByText("Ce code ne s’applique pas à l’abonnement Standard.")).toBeNull();
  });

  it("un autre refus (code inconnu, expiré) : pas de nouvel essai, le message s'efface", async () => {
    essayerCode.mockResolvedValueOnce({ ok: false, message: "Ce code n’existe pas." });
    afficher();
    await appliquer("INCONNU");
    await user.click(screen.getByRole("radio", { name: /Basique/ }));
    expect(essayerCode).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Ce code n’existe pas.")).toBeNull();
  });

  it("une réponse arrivée après un autre choix est ignorée", async () => {
    let repondre: (r: Awaited<ReturnType<typeof essayerCode>>) => void = () => {};
    essayerCode.mockImplementationOnce(() => new Promise((ok) => (repondre = ok)));
    afficher();
    await appliquer();
    await user.click(screen.getByRole("radio", { name: /Basique/ }));
    await act(async () => repondre({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000 }));
    expect(screen.queryByText(/Code appliqué/)).toBeNull();
    expect(screen.getByRole("button", { name: `Payer ${montantFcfa(9000)}` })).toBeInTheDocument();
  });
});

describe("Le pays et l'opérateur (Payiz, tous pays)", () => {
  const avecMoyens = (props: Partial<Parameters<typeof Souscription>[0]> = {}) => afficher({ moyens: { 15000: MOYENS, 9000: MOYENS }, ...props });
  const champPays = () => screen.getByRole("combobox", { name: "Pays" });
  const operateursProposes = () => within(screen.getByRole("radiogroup", { name: "Opérateur" })).getAllByRole("radio").map((r) => r.textContent);

  it("le Bénin par défaut, son indicatif devant le numéro, ses opérateurs avec logo et nom, Celtiis compris", async () => {
    avecMoyens();
    expect(champPays()).toHaveTextContent("Bénin");
    expect(await optionsDeLaListe(champPays(), { user })).toEqual(["Bénin", "Ghana", "Togo"]);
    expect(screen.getByText("+229")).toBeInTheDocument();
    expect(operateursProposes()).toEqual(["MTN Mobile Money", "Moov Money", "Celtiis Cash"]);
    const logo = screen.getByRole("radio", { name: /MTN Mobile Money/ }).querySelector("img");
    expect(logo).toHaveAttribute("src", "https://cdn.payiz.app/operateurs/mtn.png");
    // Sans logo chez Payiz : l'initiale.
    expect(screen.getByRole("radio", { name: /Celtiis Cash/ }).querySelector("img")).toBeNull();
  });

  it("le premier pays proposé quand le Bénin ne l'est pas", () => {
    afficher({ moyens: { 15000: { repli: false, pays: MOYENS.pays.slice(1) } } });
    expect(champPays()).toHaveTextContent("Ghana");
    expect(screen.getByText("+233")).toBeInTheDocument();
  });

  it("un autre pays : son indicatif et ses seuls opérateurs ; le paiement part avec le pays et l'opérateur", async () => {
    payer.mockResolvedValue({ etat: "erreur", message: "x" });
    avecMoyens();
    await choisirDansListe(champPays(), "Togo", { user });
    expect(screen.getByText("+228")).toBeInTheDocument();
    expect(screen.queryByText("+229")).toBeNull();
    expect(operateursProposes()).toEqual(["Mixx by Yas", "Moov Africa"]);
    await allerAuPaiement("96 12 34 56");
    expect(screen.getByRole("radio", { name: /Moov Africa/ })).toBeChecked();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "", telephone: "96 12 34 56", pays: "TGO", operateur: "moov" });
  });

  it("l'opérateur se choisit d'après les préfixes de Payiz, et reste modifiable", async () => {
    avecMoyens();
    await allerAuPaiement("01 43 00 00 00");
    expect(screen.getByRole("radio", { name: /Celtiis Cash/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /MTN Mobile Money/ }));
    expect(screen.getByRole("radio", { name: /MTN Mobile Money/ })).toBeChecked();
    // Une fois choisi à la main, le numéro ne le change plus.
    await user.clear(screen.getByLabelText("Numéro Mobile Money"));
    await user.type(screen.getByLabelText("Numéro Mobile Money"), "01 55 00 00 00");
    expect(screen.getByRole("radio", { name: /MTN Mobile Money/ })).toBeChecked();
  });

  it("« Vous paierez » quand Payiz annonce une autre monnaie ; rien quand c'est le prix en FCFA", async () => {
    avecMoyens();
    await user.click(screen.getByRole("radio", { name: /MTN Mobile Money/ }));
    expect(screen.queryByText(/Vous paierez/)).toBeNull();
    await choisirDansListe(champPays(), "Ghana", { user });
    expect(screen.getByText("Vous paierez 321,50 GHS (frais compris)")).toBeInTheDocument();
  });

  it("un pays à un seul opérateur : il est choisi d'office", async () => {
    avecMoyens();
    await choisirDansListe(champPays(), "Ghana", { user });
    expect(screen.getByRole("radio", { name: /MTN MoMo/ })).toBeChecked();
  });

  it("un montant hors des limites de l'opérateur : on le dit", async () => {
    const limite: MoyensDePaiement = {
      repli: false,
      pays: [{ ...MOYENS.pays[0], operateurs: [...MOYENS.pays[0].operateurs.slice(0, 1), operateur("moov", "Moov Money", { maximum: 10000 })] }],
    };
    afficher({ moyens: { 15000: limite } });
    await user.click(screen.getByRole("radio", { name: /Moov Money/ }));
    expect(screen.getByText("Ce montant dépasse les limites de cet opérateur. Choisissez un autre opérateur.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /MTN Mobile Money/ }));
    expect(screen.queryByText(/dépasse les limites/)).toBeNull();
  });

  it("des frais annoncés en FCFA s'affichent aussi", () => {
    const avecFrais: MoyensDePaiement = {
      repli: false,
      pays: [{ ...MOYENS.pays[0], operateurs: [operateur("mtn", "MTN Mobile Money", { montantAPayer: 15450 })] }],
    };
    afficher({ moyens: { 15000: avecFrais } });
    expect(screen.getByText(texte(`Vous paierez ${montantFcfa(15450)} (frais compris)`))).toBeInTheDocument();
  });

  it("un code promo : le montant à payer pour le nouveau total, repris dans la demande envoyée", async () => {
    const pour12000: MoyensDePaiement = {
      repli: false,
      pays: [{ ...MOYENS.pays[1], operateurs: [operateur("mtn", "MTN MoMo", { devise: "GHS", montantAPayer: 25720 })] }],
    };
    essayerCode.mockResolvedValue({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000, moyens: pour12000 });
    payer.mockResolvedValue(attente());
    avecMoyens();
    await choisirDansListe(champPays(), "Ghana", { user });
    await user.type(screen.getByLabelText("Code promo (facultatif)"), "promo20");
    await user.click(screen.getByRole("button", { name: "Appliquer" }));
    expect(screen.getByText("Vous paierez 257,20 GHS (frais compris)")).toBeInTheDocument();
    await allerAuPaiement("24 123 4567");
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(12000)}` }));
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "promo20", telephone: "24 123 4567", pays: "GHA", operateur: "mtn" });
    expect(screen.getByRole("dialog", { name: "Confirmez sur votre téléphone" })).toHaveTextContent("Une demande de 257,20 GHS a été envoyée");
  });

  it("operator_required : seuls les opérateurs candidats sont proposés, avec le message", async () => {
    payer.mockResolvedValue({ etat: "erreur", message: "Choisissez votre opérateur : MTN Mobile Money ou Celtiis Cash.", candidats: ["mtn", "celtiis"] });
    avecMoyens();
    await allerAuPaiement("01 40 00 00 00");
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(screen.getByRole("alert")).toHaveTextContent("Choisissez votre opérateur : MTN Mobile Money ou Celtiis Cash.");
    expect(operateursProposes()).toEqual(["MTN Mobile Money", "Celtiis Cash"]);
    // Un autre numéro : tous les opérateurs reviennent.
    await user.type(screen.getByLabelText("Numéro Mobile Money"), "1");
    expect(operateursProposes()).toEqual(["MTN Mobile Money", "Moov Money", "Celtiis Cash"]);
  });

  it("Payiz muet : le repli (Bénin, MTN et Moov) et un message discret", () => {
    afficher({ moyens: { 15000: MOYENS_REPLI } });
    expect(champPays()).toHaveTextContent("Bénin");
    expect(operateursProposes()).toEqual(["MTN Mobile Money", "Moov Money"]);
    expect(screen.getByText("La liste des opérateurs n’a pas pu être chargée : seuls MTN et Moov, au Bénin, sont proposés pour le moment.")).toBeInTheDocument();
  });

  it("paiements fermés : pas de message de repli", () => {
    afficher({ ouverts: false });
    expect(screen.queryByText(/La liste des opérateurs/)).toBeNull();
  });
});

describe("L'attente et le résultat", () => {
  it("attente puis succès : numéro masqué, compte à rebours, reçu", async () => {
    payer.mockResolvedValue(attente());
    suivre.mockResolvedValueOnce(attente()).mockResolvedValueOnce(attente()).mockResolvedValue(reussi());
    afficher();
    await allerAuPaiement();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "", telephone: "01 42 00 00 00", pays: "BEN", operateur: "mtn" });
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
    expect(reessayer).toHaveBeenCalledWith({ paiementId: PAIEMENT_ID, telephone: "01 42 00 00 00", pays: "BEN", operateur: "mtn" });
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
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "OFFERT", telephone: "", pays: "BEN", operateur: null });
    expect(screen.getByRole("dialog", { name: "Paiement confirmé" })).toBeInTheDocument();
  });
});

describe("Les opérateurs qui valident autrement (12 novembre 2026)", () => {
  // SasPay comble les pays que Payiz n'encaisse pas : Wave et Orange Money font valider sur leur page, Orange Côte
  // d'Ivoire demande un code de paiement généré d'avance. Rien à l'écran ne nomme le prestataire.
  const IVOIRE: MoyensDePaiement = {
    repli: false,
    pays: [
      ...MOYENS.pays,
      {
        code: "CIV",
        nom: "Côte d’Ivoire",
        indicatif: "+225",
        operateurs: [
          operateur("wave_ci", "Wave", { validation: "page", logo: null, montantAPayer: null }),
          operateur("orange_ci", "Orange Money", { validation: "code", consigne: "Composez #144*82# sur votre téléphone pour obtenir votre code de paiement.", logo: null, montantAPayer: null }),
        ],
      },
    ],
  };
  const afficherIvoire = async () => {
    afficher({ moyens: { 15000: IVOIRE } });
    await choisirDansListe(screen.getByRole("combobox", { name: "Pays" }), "Côte d’Ivoire", { user });
    await allerAuPaiement("07 00 00 00 00");
  };

  it("un opérateur à code de paiement : le champ, avec ce qu'il faut composer ; le code part avec le paiement", async () => {
    payer.mockResolvedValue({ etat: "erreur", message: "x" });
    await afficherIvoire();
    expect(screen.queryByLabelText("Code de paiement")).toBeNull();
    await user.click(screen.getByRole("radio", { name: /Orange Money/ }));
    expect(screen.getByText("Composez #144*82# sur votre téléphone pour obtenir votre code de paiement.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Code de paiement"), "123456");
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    expect(payer).toHaveBeenCalledWith({ formuleId: "f-standard", code: "", telephone: "07 00 00 00 00", pays: "CIV", operateur: "orange_ci", codePaiement: "123456" });
  });

  it("Wave : validation sur la page de l'opérateur, où l'étudiant est envoyé (et un lien s'il n'y est pas allé)", async () => {
    payer.mockResolvedValue({ ...(attente() as Extract<EtapePaiement, { etat: "attente" }>), redirection: "https://pay.wave.example/sp1" });
    suivre.mockResolvedValue(attente());
    await afficherIvoire();
    await user.click(screen.getByRole("radio", { name: /Wave/ }));
    expect(screen.getByText("Vous validerez le paiement sur la page de votre opérateur.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: `Payer ${montantFcfa(15000)}` }));
    const fenetre = screen.getByRole("dialog", { name: "Validez sur la page de votre opérateur" });
    expect(within(fenetre).getByRole("link", { name: "Ouvrir la page de paiement" })).toHaveAttribute("href", "https://pay.wave.example/sp1");
  });

  it("le paiement ne nomme aucun prestataire", () => {
    afficher();
    expect(screen.getByText("Paiement sécurisé. Étudium ne voit jamais votre code secret.")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/payiz|saspay/i);
  });
});
