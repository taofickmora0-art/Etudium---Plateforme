// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CodePromo } from "@/lib/admin/paiements/types";
import type { Formule } from "@/lib/abonnement/types";

// Un code promo valable seulement pour les abonnements choisis (demande du 3 novembre 2026, migration 0073) : la rubrique
// « Abonnements concernés » de la fenêtre d'un code, et la colonne « Abonnements » de la liste. Sans la 0073, le
// formulaire d'avant, avec un bandeau.

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/admin/paiements/actions", () => ({ enregistrerCodePromo: vi.fn(async () => ({ ok: true })) }));
const { enregistrerCodePromo } = await import("@/lib/admin/paiements/actions");
const { OngletCodesPromo } = await import("@/components/admin/paiements/OngletCodesPromo");

const FORMULES: Formule[] = [
  { id: "f1", code: "basique", nom: "Basique", dureeMois: 3, prix: 9000, recommandee: false, active: true },
  { id: "f2", code: "standard", nom: "Standard", dureeMois: 6, prix: 15000, recommandee: true, active: true },
  { id: "f3", code: "premium", nom: "Premium", dureeMois: 12, prix: 25000, recommandee: false, active: true },
];
const code = (champs: Partial<CodePromo>): CodePromo => ({
  id: "c1",
  code: "PROMO20",
  type: "pourcentage",
  valeur: 20,
  debut: null,
  fin: null,
  limite: null,
  actif: true,
  utilisations: 0,
  creeLe: "2026-11-01T09:00:00Z",
  formules: [],
  ...champs,
});
const CODES: CodePromo[] = [
  code({ id: "c1", code: "DEUX", formules: [{ id: "f1", nom: "Basique" }, { id: "f3", nom: "Premium" }] }),
  code({ id: "c2", code: "PARTOUT", formules: FORMULES.map((f) => ({ id: f.id, nom: f.nom })) }),
];

const afficher = (props: Partial<Parameters<typeof OngletCodesPromo>[0]> = {}) =>
  render(<OngletCodesPromo codes={CODES} formules={FORMULES} parAbonnement ecriture {...props} />);

let user: ReturnType<typeof userEvent.setup>;
beforeEach(() => {
  vi.mocked(enregistrerCodePromo).mockClear();
  user = userEvent.setup();
});

const nouveauCode = async () => {
  await user.click(screen.getByRole("button", { name: "Nouveau code" }));
  return screen.getByRole("dialog", { name: "Nouveau code promo" });
};
const remplir = async (fenetre: HTMLElement) => {
  await user.type(within(fenetre).getByLabelText("Code"), "basique10");
  await user.type(within(fenetre).getByLabelText("Valeur (%)"), "10");
};

describe("La fenêtre d'un code : « Abonnements concernés »", () => {
  it("une case par abonnement, avec son nom et sa durée ; toutes décochées pour un nouveau code", async () => {
    afficher();
    const fenetre = await nouveauCode();
    const rubrique = within(fenetre).getByRole("group", { name: "Abonnements concernés" });
    const cases = within(rubrique).getAllByRole("checkbox");
    expect(cases).toHaveLength(3);
    expect(within(rubrique).getByRole("checkbox", { name: "Basique · 3 mois" })).not.toBeChecked();
    expect(within(rubrique).getByRole("checkbox", { name: "Standard · 6 mois" })).not.toBeChecked();
    expect(within(rubrique).getByRole("checkbox", { name: "Premium · 1 an" })).not.toBeChecked();
  });

  it("un abonnement non proposé reste cochable, et le dit", async () => {
    afficher({ formules: FORMULES.map((f) => (f.code === "premium" ? { ...f, active: false } : f)) });
    const fenetre = await nouveauCode();
    expect(within(fenetre).getByRole("checkbox", { name: "Premium · 1 an · non proposé" })).toBeEnabled();
  });

  it("aucune case cochée : l'erreur sous la rubrique, rien n'est envoyé ; elle part dès qu'on coche", async () => {
    afficher();
    const fenetre = await nouveauCode();
    await remplir(fenetre);
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    const rubrique = within(fenetre).getByRole("group", { name: "Abonnements concernés" });
    expect(within(rubrique).getByRole("alert")).toHaveTextContent("Choisissez au moins un abonnement.");
    expect(enregistrerCodePromo).not.toHaveBeenCalled();
    await user.click(within(rubrique).getByRole("checkbox", { name: "Basique · 3 mois" }));
    expect(within(rubrique).queryByRole("alert")).toBeNull();
  });

  it("l'enregistrement envoie les abonnements cochés, dans leur ordre", async () => {
    afficher();
    const fenetre = await nouveauCode();
    await remplir(fenetre);
    await user.click(within(fenetre).getByRole("checkbox", { name: "Premium · 1 an" }));
    await user.click(within(fenetre).getByRole("checkbox", { name: "Basique · 3 mois" }));
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerCodePromo).toHaveBeenCalledWith(expect.objectContaining({ id: null, code: "basique10", valeur: "10", formules: ["f1", "f3"] }));
  });

  it("modifier un code coche ses abonnements ; décocher les retire de l'envoi", async () => {
    afficher();
    await user.click(within(screen.getByRole("row", { name: /DEUX/ })).getByRole("button", { name: "Modifier" }));
    const fenetre = screen.getByRole("dialog", { name: "Modifier le code DEUX" });
    expect(within(fenetre).getByRole("checkbox", { name: "Basique · 3 mois" })).toBeChecked();
    expect(within(fenetre).getByRole("checkbox", { name: "Standard · 6 mois" })).not.toBeChecked();
    expect(within(fenetre).getByRole("checkbox", { name: "Premium · 1 an" })).toBeChecked();
    await user.click(within(fenetre).getByRole("checkbox", { name: "Basique · 3 mois" }));
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerCodePromo).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", formules: ["f3"] }));
  });

  it("désactiver un code garde ses abonnements", async () => {
    afficher();
    await user.click(within(screen.getByRole("row", { name: /DEUX/ })).getByRole("button", { name: "Désactiver" }));
    expect(enregistrerCodePromo).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", actif: false, formules: ["f1", "f3"] }));
  });
});

describe("La liste : la colonne « Abonnements »", () => {
  it("les noms des abonnements du code, ou « Tous » quand il vaut pour tous", () => {
    afficher();
    expect(screen.getByRole("columnheader", { name: "Abonnements" })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /DEUX/ })).getByRole("cell", { name: "Basique, Premium" })).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /PARTOUT/ })).getByRole("cell", { name: "Tous" })).toBeInTheDocument();
  });
});

describe("Sans la migration 0073", () => {
  const sans = () => afficher({ codes: CODES.map((c) => ({ ...c, formules: [] })), parAbonnement: false });

  it("le formulaire d'avant, avec un bandeau, et l'enregistrement sans abonnements", async () => {
    sans();
    const fenetre = await nouveauCode();
    expect(within(fenetre).queryByRole("group", { name: "Abonnements concernés" })).toBeNull();
    expect(within(fenetre).getByText("Appliquez la migration 0073 (guide « Ce qui te revient », section 72).")).toBeInTheDocument();
    await remplir(fenetre);
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(enregistrerCodePromo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(enregistrerCodePromo).mock.calls[0][0]).not.toHaveProperty("formules");
  });

  it("pas de colonne « Abonnements » ; désactiver part sans abonnements", async () => {
    sans();
    expect(screen.queryByRole("columnheader", { name: "Abonnements" })).toBeNull();
    await user.click(within(screen.getByRole("row", { name: /DEUX/ })).getByRole("button", { name: "Désactiver" }));
    expect(vi.mocked(enregistrerCodePromo).mock.calls[0][0]).not.toHaveProperty("formules");
  });
});
