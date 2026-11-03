// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { choisirDansListe } from "../utilitaires/listes";

// La fiche d'un parcours au back-office (demande du 2 novembre 2026) : ses chiffres, ses formations (ranger, changer de
// parcours, ajouter), ses apprenants, et ses réglages.

const { changerParcoursFormation, ajouterFormationParcours } = vi.hoisted(() => ({
  changerParcoursFormation: vi.fn(async () => ({ ok: true })),
  ajouterFormationParcours: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/admin/actions", () => ({
  changerParcoursFormation,
  ajouterFormationParcours,
  rangerFormationParcours: vi.fn(async () => ({ ok: true })),
  saveParcours: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }), usePathname: () => "/admin/parcours/p1" }));

const { FicheParcours } = await import("@/components/admin/parcours/FicheParcours");
const { versFicheParcours } = await import("@/lib/admin/parcours-chiffres");

const parcours = (id: string, nom: string, couleur: ParcoursAdmin["couleur"]): ParcoursAdmin => ({ id, slug: id, nom, nomCourt: nom, description: "", couleur, ordre: 0, actif: true });
const P1 = parcours("p1", "Réussite académique", "academique");
const TOUS = [P1, parcours("p2", "Compétences digitales", "digital"), parcours("p3", "Business", "business")];
const FICHE = versFicheParcours({
  chiffres: { formations_publiees: 2, formations_brouillons: 1, apprenants: 205, certificats: 54, sessions_a_venir: 1, publications_30j: 37 },
  formations: [
    { id: "f1", titre: "Word", slug: "word", statut: "publiee", apprenants: 120, certificats: 40, autres_parcours: [] },
    { id: "f2", titre: "Zotero", slug: "zotero", statut: "publiee", apprenants: 85, certificats: 14, autres_parcours: ["Compétences digitales"] },
    { id: "f3", titre: "Mémoire", slug: "memoire", statut: "brouillon", apprenants: 0, certificats: 0, autres_parcours: [] },
  ],
  apprenants: {
    total: 2,
    liste: [
      { id: "u1", nom: "Aïcha Kpadé", formations: 2, certificats: 1, derniere_activite: "2026-11-01T10:00:00Z" },
      { id: "u2", nom: "Jules Koffi", formations: 1, certificats: 0, derniere_activite: "2026-10-28T10:00:00Z" },
    ],
  },
  sessions: [{ id: "s1", titre: "Atelier Word", debut: "2026-11-07T14:00:00Z" }],
  a_ajouter: [{ id: "f4", titre: "Canva", statut: "publiee" }],
});

const afficher = (onglet = "ensemble") =>
  render(
    <ToastProvider>
      <FicheParcours parcours={P1} fiche={FICHE} tousLesParcours={TOUS} ongletInitial={onglet} />
    </ToastProvider>,
  );

beforeEach(() => {
  changerParcoursFormation.mockClear();
  ajouterFormationParcours.mockClear();
});

describe("La fiche d'un parcours", () => {
  it("quatre onglets ; la vue d'ensemble : les chiffres et les prochaines sessions", () => {
    afficher();
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Vue d’ensemble", "Formations", "Apprenants", "Réglages"]);
    expect(screen.getAllByTestId("indicateur-parcours").map((t) => t.textContent)).toEqual([
      "Formations publiées2",
      "Brouillons1",
      "Apprenants205",
      "Certificats54",
      "Sessions live à venir1",
      "Publications (30 jours)37",
    ]);
    expect(screen.getByText("Atelier Word")).toBeInTheDocument();
  });

  it("les formations, dans l'ordre du parcours : statut, chiffres, autres parcours, lien vers la formation", () => {
    afficher("formations");
    const lignes = within(screen.getByRole("list", { name: "Formations du parcours" })).getAllByRole("listitem");
    expect(lignes).toHaveLength(3);
    expect(within(lignes[0]).getByRole("link", { name: "Word" })).toHaveAttribute("href", "/admin/formations/f1");
    expect(lignes[1]).toHaveTextContent("Aussi dans : Compétences digitales");
    expect(lignes[1]).toHaveTextContent("85 apprenants · 14 certificats");
    expect(within(lignes[2]).getByText("Brouillon")).toBeInTheDocument();
    expect(within(lignes[0]).getByRole("button", { name: "Déplacer « Word »" })).toBeInTheDocument();
  });

  it("changer une formation de parcours : on choisit l'autre parcours, puis on confirme", async () => {
    afficher("formations");
    await userEvent.click(screen.getByRole("button", { name: "Actions pour Word" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Changer de parcours/ }));
    const fenetre = await screen.findByRole("dialog", { name: "Changer « Word » de parcours" });
    expect(within(fenetre).getAllByRole("radio").map((r) => r.closest("label")?.textContent)).toEqual(["Compétences digitales", "Business"]);
    await userEvent.click(within(fenetre).getByRole("radio", { name: "Business" }));
    await userEvent.click(within(fenetre).getByRole("button", { name: "Changer de parcours" }));
    expect(changerParcoursFormation).toHaveBeenCalledWith("f1", "p1", "p3");
  });

  it("ajouter une formation existante au parcours", async () => {
    afficher("formations");
    await userEvent.click(screen.getByRole("button", { name: "Ajouter une formation" }));
    const fenetre = await screen.findByRole("dialog", { name: "Ajouter une formation au parcours" });
    await choisirDansListe("Formation", "Canva", { dans: fenetre });
    await userEvent.click(within(fenetre).getByRole("button", { name: "Ajouter" }));
    expect(ajouterFormationParcours).toHaveBeenCalledWith("p1", "f4");
  });

  it("les apprenants : le plus récemment actif d'abord, avec un lien vers sa fiche", () => {
    afficher("apprenants");
    const tableau = screen.getByRole("table", { name: "Apprenants du parcours" });
    const lignes = within(tableau).getAllByRole("row").slice(1);
    expect(lignes.map((l) => within(l).getAllByRole("cell").slice(0, 3).map((c) => c.textContent))).toEqual([
      ["Aïcha Kpadé", "2", "1"],
      ["Jules Koffi", "1", "0"],
    ]);
    expect(within(lignes[0]).getByRole("link", { name: "Aïcha Kpadé" })).toHaveAttribute("href", "/admin/utilisateurs/u1");
  });
});
