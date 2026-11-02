// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ChiffresFormations } from "@/lib/admin/cartes-chiffres";
import type { FormationAdmin, FormationResume } from "@/lib/admin/types";

// Le menu ⋮ des cartes de la page Formations du back-office (demande du 2 novembre 2026) : modifier, voir dans le
// catalogue, changer l'état, supprimer ; les mêmes fenêtres que l'onglet « Publication » de la fiche.

const setStatutFormation = vi.fn();
const deleteFormation = vi.fn();
const renvoyerAuFormateur = vi.fn();
vi.mock("@/lib/admin/actions", () => ({
  setStatutFormation: (...a: unknown[]) => setStatutFormation(...a),
  deleteFormation: (...a: unknown[]) => deleteFormation(...a),
  renvoyerAuFormateur: (...a: unknown[]) => renvoyerAuFormateur(...a),
}));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => routeur, usePathname: () => "/admin/formations" }));

const { GrilleFormationsAdmin } = await import("@/components/admin/formations/GrilleFormationsAdmin");
const { PublicationPanel } = await import("@/components/admin/PublicationPanel");
const { versChiffresFormations } = await import("@/lib/admin/cartes-chiffres");
const { texteDesactivation } = await import("@/lib/admin/desactivation");

type Etat = FormationResume["etat"];
const STATUT_DE: Record<Etat, FormationResume["statut"]> = {
  brouillon: "brouillon",
  en_attente: "brouillon",
  a_corriger: "brouillon",
  publiee: "publiee",
  desactivee: "desactivee",
  archivee: "archivee",
};
const formation = (etat: Etat, plus: Partial<FormationResume> = {}): FormationResume => ({
  id: "f1",
  slug: "maitriser-excel",
  titre: "Maîtriser Excel",
  statut: STATUT_DE[etat],
  niveau: "debutant",
  nbLecons: 4,
  parcours: ["Académique"],
  etat,
  modifieeParFormateurLe: null,
  modificationsNonPubliees: false,
  resume: "",
  couverture: null,
  note: null,
  nbAvis: 0,
  formateur: null,
  couleur: "academique",
  publieeLe: STATUT_DE[etat] === "brouillon" ? null : "2026-10-01T08:00:00Z",
  ...plus,
});
const CHIFFRES = versChiffresFormations({ apprenants_total: 12, formations: [{ id: "f1", apprenants: 12, certificats: 3, a_corriger: 0 }] });

const carte = (f: FormationResume, chiffres: ChiffresFormations | null = CHIFFRES) =>
  render(
    <ToastProvider>
      <GrilleFormationsAdmin formations={[f]} chiffres={chiffres} />
    </ToastProvider>,
  );
const user = () => userEvent.setup();
const ouvrirMenu = async (u: ReturnType<typeof userEvent.setup>, titre = "Maîtriser Excel") => {
  await u.click(screen.getByRole("button", { name: `Actions pour « ${titre} »` }));
  return screen.getByRole("menu");
};
const entrees = (menu: HTMLElement) => within(menu).getAllByRole("menuitem").map((e) => e.textContent);

beforeEach(() => {
  setStatutFormation.mockReset().mockResolvedValue({ ok: true });
  deleteFormation.mockReset().mockResolvedValue({ ok: true, redirection: "/admin/formations" });
  renvoyerAuFormateur.mockReset().mockResolvedValue({ ok: true });
  for (const f of Object.values(routeur)) f.mockReset();
});

describe("Le menu ⋮ d'une carte de formation", () => {
  it.each<[Etat, string[]]>([
    ["brouillon", ["Modifier", "Publier", "Supprimer"]],
    ["a_corriger", ["Modifier", "Publier", "Supprimer"]],
    ["en_attente", ["Modifier", "Publier", "Renvoyer au formateur", "Supprimer"]],
    ["publiee", ["Modifier", "Voir dans le catalogue", "Archiver", "Désactiver", "Supprimer"]],
    ["desactivee", ["Modifier", "Archiver", "Réactiver", "Supprimer"]],
    ["archivee", ["Modifier", "Republier", "Supprimer"]],
  ])("%s : les entrées du menu", async (etat, attendues) => {
    const u = user();
    carte(formation(etat));
    const menu = await ouvrirMenu(u);
    expect(entrees(menu)).toEqual(attendues);
    expect(within(menu).getByRole("menuitem", { name: "Modifier" })).toHaveAttribute("href", "/admin/formations/f1");
    expect(within(menu).getByRole("menuitem", { name: "Supprimer" })).toHaveClass("text-erreur-texte");
  });

  it("publiée : « Voir dans le catalogue » mène à sa fiche publique", async () => {
    const u = user();
    carte(formation("publiee"));
    const menu = await ouvrirMenu(u);
    expect(within(menu).getByRole("menuitem", { name: "Voir dans le catalogue" })).toHaveAttribute("href", "/formations/maitriser-excel");
  });

  it("le bouton ⋮ est sur la carte, hors de son lien", () => {
    carte(formation("publiee"));
    const lien = screen.getByRole("link", { name: /Maîtriser Excel/ });
    const bouton = screen.getByRole("button", { name: "Actions pour « Maîtriser Excel »" });
    expect(screen.getByRole("listitem")).toContainElement(bouton);
    expect(lien).not.toContainElement(bouton);
    expect(lien.querySelector("button")).toBeNull();
  });

  it("archiver une publiée : la confirmation, l'action, le message, puis la liste se relit", async () => {
    const u = user();
    carte(formation("publiee"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Archiver" }));
    const fenetre = screen.getByRole("dialog", { name: "Archiver cette formation ?" });
    expect(fenetre).toHaveTextContent("Elle disparaît du catalogue et ses leçons se ferment. Rien n’est supprimé : vous pourrez la republier.");
    expect(setStatutFormation).not.toHaveBeenCalled();
    await u.click(within(fenetre).getByRole("button", { name: "Archiver" }));
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "archivee");
    expect(await screen.findByText("Formation archivée")).toBeInTheDocument();
    expect(routeur.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("désactiver : le nombre d'apprenants de la carte ; sans les chiffres, le texte général", async () => {
    const u = user();
    const { unmount } = carte(formation("publiee"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Désactiver" }));
    const fenetre = screen.getByRole("dialog", { name: "Désactiver cette formation ?" });
    expect(fenetre).toHaveTextContent(texteDesactivation(12));
    await u.click(within(fenetre).getByRole("button", { name: "Désactiver" }));
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "desactivee");
    expect(await screen.findByText("Formation désactivée")).toBeInTheDocument();
    expect(routeur.refresh).toHaveBeenCalled();
    unmount();
    carte(formation("publiee"), null);
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Désactiver" }));
    expect(screen.getByRole("dialog", { name: "Désactiver cette formation ?" })).toHaveTextContent(texteDesactivation(null));
  });

  it("supprimer un brouillon jamais publié : la suppression, et l'on reste sur la liste qui se relit", async () => {
    const u = user();
    carte(formation("brouillon"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Supprimer ce brouillon ?" });
    expect(fenetre).toHaveTextContent("Le brouillon, ses modules, ses leçons et leurs fichiers seront supprimés. Cette action est définitive.");
    await u.click(within(fenetre).getByRole("button", { name: "Supprimer" }));
    expect(deleteFormation).toHaveBeenCalledWith("f1");
    expect(await screen.findByText("Brouillon supprimé")).toBeInTheDocument();
    expect(routeur.refresh).toHaveBeenCalled();
    expect(routeur.push).not.toHaveBeenCalled();
  });

  it("supprimer une formation déjà publiée : l'explication, et « Archiver » depuis la fenêtre", async () => {
    const u = user();
    carte(formation("publiee"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Cette formation ne peut pas être supprimée" });
    expect(fenetre).toHaveTextContent(
      "Elle a déjà été publiée : ses apprenants gardent leur progression, leurs certificats et leurs avis. Archivez-la pour la retirer du catalogue.",
    );
    await u.click(within(fenetre).getByRole("button", { name: "Archiver" }));
    expect(deleteFormation).not.toHaveBeenCalled();
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "archivee");
    expect(await screen.findByText("Formation archivée")).toBeInTheDocument();
    expect(routeur.refresh).toHaveBeenCalled();
  });

  it("supprimer une formation désactivée : l'explication propose aussi « Archiver »", async () => {
    const u = user();
    carte(formation("desactivee"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Supprimer" }));
    expect(within(screen.getByRole("dialog", { name: "Cette formation ne peut pas être supprimée" })).getByRole("button", { name: "Archiver" })).toBeInTheDocument();
  });

  it("supprimer une formation archivée : l'explication, avec seulement « Fermer »", async () => {
    const u = user();
    carte(formation("archivee"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Cette formation ne peut pas être supprimée" });
    expect(within(fenetre).queryByRole("button", { name: "Archiver" })).not.toBeInTheDocument();
    // La croix de la fenêtre et le bouton du bas : rien d'autre que « Fermer ».
    const fermer = within(fenetre).getAllByRole("button", { name: "Fermer" });
    expect(within(fenetre).getAllByRole("button")).toEqual(fermer);
    await u.click(fermer[fermer.length - 1]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(setStatutFormation).not.toHaveBeenCalled();
    expect(deleteFormation).not.toHaveBeenCalled();
  });

  it("un refus reste affiché dans la fenêtre, sans relire la liste", async () => {
    setStatutFormation.mockResolvedValue({ ok: false, message: "Ajoutez au moins une leçon publiée avant de publier." });
    const u = user();
    carte(formation("brouillon"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Publier" }));
    const fenetre = screen.getByRole("dialog", { name: "Publier cette formation ?" });
    await u.click(within(fenetre).getByRole("button", { name: "Publier" }));
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "publiee");
    expect(await within(fenetre).findByText("Ajoutez au moins une leçon publiée avant de publier.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Publier cette formation ?" })).toBeInTheDocument();
    expect(routeur.refresh).not.toHaveBeenCalled();
  });

  it("en attente : « Renvoyer au formateur » avec sa remarque, puis la liste se relit", async () => {
    const u = user();
    carte(formation("en_attente"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Renvoyer au formateur" }));
    const fenetre = screen.getByRole("dialog", { name: "Renvoyer au formateur ?" });
    expect(within(fenetre).getByRole("button", { name: "Renvoyer" })).toBeDisabled();
    await u.type(within(fenetre).getByRole("textbox", { name: "Remarque pour le formateur" }), "Ajoutez une vidéo.");
    await u.click(within(fenetre).getByRole("button", { name: "Renvoyer" }));
    expect(renvoyerAuFormateur).toHaveBeenCalledWith("f1", "Ajoutez une vidéo.");
    expect(await screen.findByText("Formation renvoyée au formateur")).toBeInTheDocument();
    expect(routeur.refresh).toHaveBeenCalled();
  });

  it("archivée : « Republier » ouvre la fenêtre de l'onglet « Publication »", async () => {
    const u = user();
    carte(formation("archivee"));
    await u.click(within(await ouvrirMenu(u)).getByRole("menuitem", { name: "Republier" }));
    const fenetre = screen.getByRole("dialog", { name: "Republier cette formation ?" });
    expect(fenetre).toHaveTextContent("Elle revient dans le catalogue et ses leçons se rouvrent.");
    await u.click(within(fenetre).getByRole("button", { name: "Republier" }));
    expect(setStatutFormation).toHaveBeenCalledWith("f1", "publiee");
    expect(await screen.findByText("Formation publiée")).toBeInTheDocument();
  });
});

describe("L'onglet « Publication » garde son comportement", () => {
  type Pub = Pick<FormationAdmin, "statut" | "etat" | "envoyeeLe" | "renvoyeeLe" | "remarqueRelecture" | "modifieeParFormateurLe" | "publieeLe" | "modificationsNonPubliees">;
  const pub = (etat: Etat): Pub => ({
    statut: STATUT_DE[etat],
    etat,
    envoyeeLe: etat === "en_attente" ? "2026-10-13T08:00:00Z" : null,
    renvoyeeLe: null,
    remarqueRelecture: null,
    modifieeParFormateurLe: null,
    publieeLe: STATUT_DE[etat] === "brouillon" ? null : "2026-10-01T08:00:00Z",
    modificationsNonPubliees: false,
  });
  const panneau = (etat: Etat) =>
    render(
      <ToastProvider>
        <PublicationPanel id="f1" formation={pub(etat)} formateurNom={null} suiveurs={3} />
      </ToastProvider>,
    );

  it.each<[Etat, string[]]>([
    ["brouillon", ["Publier", "Supprimer le brouillon"]],
    ["en_attente", ["Publier", "Renvoyer au formateur", "Supprimer le brouillon"]],
    ["publiee", ["Archiver", "Désactiver"]],
    ["desactivee", ["Archiver", "Réactiver"]],
    ["archivee", ["Republier"]],
  ])("%s : les mêmes boutons, dans le même ordre", (etat, attendus) => {
    panneau(etat);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(attendus);
  });

  it("supprimer le brouillon : la fiche suit la redirection vers la liste", async () => {
    const u = user();
    panneau("brouillon");
    await u.click(screen.getByRole("button", { name: "Supprimer le brouillon" }));
    await u.click(within(screen.getByRole("dialog", { name: "Supprimer ce brouillon ?" })).getByRole("button", { name: "Supprimer" }));
    expect(deleteFormation).toHaveBeenCalledWith("f1");
    expect(await screen.findByText("Brouillon supprimé")).toBeInTheDocument();
    expect(routeur.push).toHaveBeenCalledWith("/admin/formations");
  });

  it("désactiver : le nombre de suiveurs passé à l'onglet", async () => {
    const u = user();
    panneau("publiee");
    await u.click(screen.getByRole("button", { name: "Désactiver" }));
    expect(screen.getByRole("dialog", { name: "Désactiver cette formation ?" })).toHaveTextContent(texteDesactivation(3));
  });

  it("un refus reste affiché dans la fenêtre", async () => {
    setStatutFormation.mockResolvedValue({ ok: false, message: "Archivage impossible pour le moment." });
    const u = user();
    panneau("publiee");
    await u.click(screen.getByRole("button", { name: "Archiver" }));
    const fenetre = screen.getByRole("dialog", { name: "Archiver cette formation ?" });
    await u.click(within(fenetre).getByRole("button", { name: "Archiver" }));
    expect(await within(fenetre).findByText("Archivage impossible pour le moment.")).toBeInTheDocument();
  });
});
