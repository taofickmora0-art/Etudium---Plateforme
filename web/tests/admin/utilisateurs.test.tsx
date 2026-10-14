// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Role } from "@/lib/auth/permissions";
import type { CompteDetail, PageComptes } from "@/lib/utilisateurs/types";

// Page Utilisateurs du back-office (spec 2026-10-13-utilisateurs-roles, §2 et §3).

const chercherComptes = vi.fn();
const changerRoles = vi.fn();
const suspendreCompte = vi.fn();
const reactiverCompte = vi.fn();
vi.mock("@/lib/utilisateurs/actions", () => ({
  chercherComptes: (...a: unknown[]) => chercherComptes(...a),
  changerRoles: (...a: unknown[]) => changerRoles(...a),
  suspendreCompte: (...a: unknown[]) => suspendreCompte(...a),
  reactiverCompte: (...a: unknown[]) => reactiverCompte(...a),
}));
const routeur = { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() };
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
vi.mock("next/navigation", () => ({ useRouter: () => routeur, usePathname: () => "/admin/utilisateurs", notFound: () => notFound() }));
const getAuthUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getAuthUser: () => getAuthUser(), getShellUser: vi.fn(), demoModeActive: () => false }));
const lireCompte = vi.fn();
const lireFichesLibres = vi.fn();
const lireRemarquesFormateurs = vi.fn(async () => ({ migrationAbsente: false, donnees: [] as unknown[] }));
vi.mock("@/lib/utilisateurs/data", () => ({
  lireCompte: (...a: unknown[]) => lireCompte(...a),
  lireFichesLibres: () => lireFichesLibres(),
  lireComptes: vi.fn(),
  lireRemarquesFormateurs: () => lireRemarquesFormateurs(),
}));

const { ListeComptes } = await import("@/components/admin/utilisateurs/ListeComptes");
const { RolesCompte } = await import("@/components/admin/utilisateurs/RolesCompte");
const { SuspensionCompte } = await import("@/components/admin/utilisateurs/SuspensionCompte");
const { ActiviteCompte } = await import("@/components/admin/utilisateurs/ActiviteCompte");
const { FicheUtilisateur } = await import("@/components/admin/utilisateurs/FicheUtilisateur");

const ID = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const FICHE = "33333333-3333-4333-8333-333333333333";

const PAGE: PageComptes = {
  total: 2,
  comptes: [
    { id: ID, prenom: "Fifamè", nom: "Adjovi", email: "fifame@exemple.com", roles: ["etudiant", "formateur"], inscritLe: "2026-10-12T09:00:00Z", derniereConnexion: null, suspendu: false },
    { id: ID2, prenom: "", nom: "", email: "rodrigue@exemple.com", roles: ["etudiant", "admin"], inscritLe: "2026-10-11T09:00:00Z", derniereConnexion: "2026-10-13T08:00:00Z", suspendu: true },
  ],
};

const COMPTE: CompteDetail = {
  id: ID,
  prenom: "Fifamè",
  nom: "Adjovi",
  email: "fifame@exemple.com",
  roles: ["etudiant"],
  inscritLe: "2026-10-12T09:00:00Z",
  derniereConnexion: null,
  suspension: null,
  ficheFormateur: null,
  formations: [],
  avis: [],
};

const avecToast = (enfant: React.ReactNode) => render(<ToastProvider>{enfant}</ToastProvider>);

beforeEach(() => {
  for (const f of [chercherComptes, changerRoles, suspendreCompte, reactiverCompte, routeur.push, routeur.replace, notFound, getAuthUser, lireCompte, lireFichesLibres]) f.mockClear();
  chercherComptes.mockResolvedValue({ ok: true, page: { total: 0, comptes: [] } });
  changerRoles.mockResolvedValue({ ok: true });
  suspendreCompte.mockResolvedValue({ ok: true });
  reactiverCompte.mockResolvedValue({ ok: true });
});

describe("Liste des comptes", () => {
  const ADMIN = { id: "moi", roles: ["etudiant", "admin"] as Role[] };
  const lignes = () => within(screen.getByRole("table", { name: "Comptes" })).getAllByRole("row").slice(1);

  it("le tableau du design : utilisateur, e-mail, rôle, formule, statut, inscription", () => {
    avecToast(<ListeComptes initial={PAGE} moi={ADMIN} />);
    const entetes = within(screen.getByRole("table", { name: "Comptes" })).getAllByRole("columnheader").map((c) => c.textContent);
    expect(entetes.slice(0, 6)).toEqual(["Utilisateur", "E-mail", "Rôle", "Formule", "Statut", "Inscrit le"]);
    const [premier, second] = lignes();
    expect(within(premier).getAllByRole("cell").map((c) => c.textContent)).toEqual(["FAFifamè Adjovi", "fifame@exemple.com", "Formateur", "—", "Actif", "12/10/2026", ""]);
    expect(within(premier).getByRole("link", { name: "Fifamè Adjovi" })).toHaveAttribute("href", `/admin/utilisateurs/${ID}`);
    expect(within(second).getAllByRole("cell").map((c) => c.textContent)).toEqual(["RSans nom", "rodrigue@exemple.com", "Admin", "—", "Suspendu", "11/10/2026", ""]);
  });

  it("le menu d'une ligne : voir le profil, et suspendre selon les droits", async () => {
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={{ total: 1, comptes: [{ ...PAGE.comptes[0], roles: ["etudiant"] }] }} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Actions pour Fifamè Adjovi" }));
    expect(screen.getByRole("menuitem", { name: "Voir le profil" })).toHaveAttribute("href", `/admin/utilisateurs/${ID}`);
    expect(screen.getByRole("menuitem", { name: "Suspendre le compte" })).toBeInTheDocument();
  });

  it("la fenêtre ouverte depuis le menu reçoit le focus (le menu ne le reprend pas en se fermant)", async () => {
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={{ total: 1, comptes: [{ ...PAGE.comptes[0], roles: ["etudiant"] }] }} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Actions pour Fifamè Adjovi" }));
    await user.click(screen.getByRole("menuitem", { name: "Suspendre le compte" }));
    const fenetre = await screen.findByRole("dialog", { name: "Suspendre ce compte ?" });
    await waitFor(() => expect(fenetre).toContainElement(document.activeElement as HTMLElement));
  });

  it("suspendre depuis la liste : la fenêtre du design, le motif, puis la liste est relue", async () => {
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={{ total: 1, comptes: [{ ...PAGE.comptes[0], roles: ["etudiant"] }] }} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Actions pour Fifamè Adjovi" }));
    await user.click(screen.getByRole("menuitem", { name: "Suspendre le compte" }));
    const fenetre = await screen.findByRole("dialog", { name: "Suspendre ce compte ?" });
    expect(fenetre).toHaveTextContent("Fifamè A. ne pourra plus se connecter ni publier. Ses formations et ses certificats sont conservés, et vous pourrez réactiver le compte à tout moment.");
    await user.type(within(fenetre).getByRole("textbox", { name: "Motif (visible par l’équipe)" }), "Spam");
    await user.click(within(fenetre).getByRole("button", { name: "Suspendre le compte" }));
    expect(suspendreCompte).toHaveBeenCalledWith(ID, "Spam");
    expect(await screen.findByText("Compte suspendu")).toBeInTheDocument();
    expect(screen.getByText("Fifamè A. ne peut plus se connecter. Vous pourrez réactiver le compte à tout moment.")).toBeInTheDocument();
    await waitFor(() => expect(chercherComptes).toHaveBeenCalledWith("", "tous", 1));
  });

  it("un compte de l'équipe, pour un admin : pas de suspension ; un compte suspendu : réactiver", async () => {
    const user = userEvent.setup();
    const premier = avecToast(<ListeComptes initial={PAGE} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Actions pour rodrigue@exemple.com" }));
    expect(screen.queryByRole("menuitem", { name: "Suspendre le compte" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Réactiver le compte" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    premier.unmount();
    const suspendu = { ...PAGE.comptes[0], suspendu: true, roles: ["etudiant"] as Role[] };
    avecToast(<ListeComptes initial={{ total: 1, comptes: [suspendu] }} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Actions pour Fifamè Adjovi" }));
    await user.click(screen.getByRole("menuitem", { name: "Réactiver le compte" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Réactiver" }));
    expect(reactiverCompte).toHaveBeenCalledWith(ID);
  });

  it("liste vide : le message", () => {
    avecToast(<ListeComptes initial={{ total: 0, comptes: [] }} moi={ADMIN} />);
    expect(screen.getByText("Aucun compte ne correspond à cette recherche.")).toBeInTheDocument();
  });

  it("la recherche appelle l'action et ne touche pas à l'adresse de la page", async () => {
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={PAGE} moi={ADMIN} />);
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un utilisateur" }), "fifa");
    await waitFor(() => expect(chercherComptes).toHaveBeenLastCalledWith("fifa", "tous", 1));
    expect(chercherComptes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Aucun compte ne correspond à cette recherche.")).toBeInTheDocument());
    expect(routeur.replace).not.toHaveBeenCalled();
    expect(routeur.push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("");
  });

  it("un filtre relance la recherche, page 1", async () => {
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={PAGE} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Suspendus" }));
    await waitFor(() => expect(chercherComptes).toHaveBeenCalledWith("", "suspendus", 1));
  });

  it("un échec de chargement est annoncé", async () => {
    chercherComptes.mockResolvedValue({ ok: false, message: "La liste n’a pas pu être chargée. Réessayez." });
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={PAGE} moi={ADMIN} />);
    await user.click(screen.getByRole("button", { name: "Formateurs" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La liste n’a pas pu être chargée. Réessayez.");
  });

  it("au-delà de 25 comptes : « 2 sur 60 utilisateurs » et la page suivante", async () => {
    const user = userEvent.setup();
    avecToast(<ListeComptes initial={{ ...PAGE, total: 60 }} moi={ADMIN} />);
    expect(screen.getByText("2 sur 60 utilisateurs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /page 2/i }));
    await waitFor(() => expect(chercherComptes).toHaveBeenCalledWith("", "tous", 2));
  });
});

describe("Rôles d'un compte", () => {
  it("en lecture seule pour qui n'est pas super admin", () => {
    avecToast(<RolesCompte compte={COMPTE} fichesLibres={[]} modifiable={false} />);
    expect(screen.getByRole("checkbox", { name: "Étudiant" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Formateur" })).toBeDisabled();
    expect(screen.getByText("Seul le super admin change les rôles.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer les rôles" })).not.toBeInTheDocument();
  });

  it("cocher Formateur demande la fiche ; Enregistrer reste désactivé tant qu'elle n'est pas choisie", async () => {
    const user = userEvent.setup();
    avecToast(<RolesCompte compte={COMPTE} fichesLibres={[{ id: FICHE, nom: "Awa Houngbo" }]} modifiable />);
    expect(screen.getByRole("checkbox", { name: "Étudiant" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Étudiant" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Enregistrer les rôles" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Formateur" }));
    const choix = screen.getByRole("combobox", { name: "Fiche formateur" });
    expect(within(choix).getByRole("option", { name: "Créer une fiche à son nom" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer les rôles" })).toBeDisabled();
    await user.selectOptions(choix, FICHE);
    expect(screen.getByRole("button", { name: "Enregistrer les rôles" })).toBeEnabled();
  });

  it("la confirmation résume le changement, puis transmet la fiche existante", async () => {
    const user = userEvent.setup();
    avecToast(<RolesCompte compte={COMPTE} fichesLibres={[{ id: FICHE, nom: "Awa Houngbo" }]} modifiable />);
    await user.click(screen.getByRole("checkbox", { name: "Formateur" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Fiche formateur" }), FICHE);
    await user.click(screen.getByRole("button", { name: "Enregistrer les rôles" }));
    const fenetre = screen.getByRole("dialog");
    expect(fenetre).toHaveTextContent("Donner : Formateur.");
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(changerRoles).toHaveBeenCalledWith(ID, ["etudiant", "formateur"], { existante: FICHE });
  });

  it("« Créer une fiche à son nom » transmet { nouvelle: true }", async () => {
    const user = userEvent.setup();
    avecToast(<RolesCompte compte={COMPTE} fichesLibres={[]} modifiable />);
    await user.click(screen.getByRole("checkbox", { name: "Formateur" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Fiche formateur" }), "Créer une fiche à son nom");
    await user.click(screen.getByRole("button", { name: "Enregistrer les rôles" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Enregistrer" }));
    expect(changerRoles).toHaveBeenCalledWith(ID, ["etudiant", "formateur"], { nouvelle: true });
  });

  it("le refus de la base est affiché tel quel", async () => {
    changerRoles.mockResolvedValue({ ok: false, message: "Vous ne pouvez pas vous retirer le rôle super admin." });
    const user = userEvent.setup();
    avecToast(<RolesCompte compte={{ ...COMPTE, roles: ["etudiant", "super_admin"] }} fichesLibres={[]} modifiable />);
    await user.click(screen.getByRole("checkbox", { name: "Super admin" }));
    await user.click(screen.getByRole("button", { name: "Enregistrer les rôles" }));
    const fenetre = screen.getByRole("dialog");
    expect(fenetre).toHaveTextContent("Retirer : Super admin.");
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(await within(fenetre).findByText("Vous ne pouvez pas vous retirer le rôle super admin.")).toBeInTheDocument();
  });

  it("une fiche déjà reliée est montrée, avec son lien", () => {
    avecToast(<RolesCompte compte={{ ...COMPTE, roles: ["etudiant", "formateur"], ficheFormateur: { id: FICHE, nom: "Fifamè Adjovi" } }} fichesLibres={[]} modifiable />);
    expect(screen.getByRole("link", { name: "Fifamè Adjovi" })).toHaveAttribute("href", `/admin/formateurs/${FICHE}`);
    expect(screen.queryByRole("combobox", { name: "Fiche formateur" })).not.toBeInTheDocument();
  });
});

describe("Suspension d'un compte", () => {
  it("sans droit (son propre compte, par exemple), aucun bouton", () => {
    avecToast(<SuspensionCompte compte={COMPTE} droits={{ suspendre: false, reactiver: false }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Ce compte est actif.")).toBeInTheDocument();
  });

  it("suspendre : confirmation avec un motif facultatif", async () => {
    const user = userEvent.setup();
    avecToast(<SuspensionCompte compte={COMPTE} droits={{ suspendre: true, reactiver: false }} />);
    await user.click(screen.getByRole("button", { name: "Suspendre le compte" }));
    const fenetre = screen.getByRole("dialog", { name: "Suspendre ce compte ?" });
    expect(fenetre).toHaveTextContent("Fifamè A. ne pourra plus se connecter ni publier.");
    await user.type(within(fenetre).getByRole("textbox", { name: "Motif (visible par l’équipe)" }), "Spam répété");
    await user.click(within(fenetre).getByRole("button", { name: "Suspendre le compte" }));
    expect(suspendreCompte).toHaveBeenCalledWith(ID, "Spam répété");
  });

  it("compte suspendu : date, auteur, motif et Réactiver", async () => {
    const user = userEvent.setup();
    const suspendu = { ...COMPTE, suspension: { depuis: "2026-10-13T08:00:00Z", parNom: "Taofick Mora", motif: "Spam répété" } };
    avecToast(<SuspensionCompte compte={suspendu} droits={{ suspendre: false, reactiver: true }} />);
    expect(screen.getByText("Suspendu depuis le 13 oct. 2026, par Taofick Mora")).toBeInTheDocument();
    expect(screen.getByText("Spam répété")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Réactiver le compte" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Réactiver" }));
    expect(reactiverCompte).toHaveBeenCalledWith(ID);
  });
});

describe("Activité d'un compte", () => {
  it("formations suivies (leçons terminées) et avis (masqués signalés)", () => {
    render(
      <ActiviteCompte
        compte={{
          ...COMPTE,
          formations: [{ id: "f", titre: "Maîtriser Microsoft Excel", slug: "excel", terminees: 6, total: 12, derniereActivite: "2026-10-13T08:00:00Z" }],
          avis: [{ id: "a", formationTitre: "Zotero", note: 4, commentaire: "x".repeat(200), masque: true, creeLe: "2026-10-11T08:00:00Z" }],
        }}
      />,
    );
    expect(screen.getByText("Maîtriser Microsoft Excel")).toBeInTheDocument();
    expect(screen.getByText(/6 \/ 12 leçons/)).toBeInTheDocument();
    expect(screen.getByText(/Dernière activité le 13 oct\. 2026/)).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
    expect(screen.getByText("Masqué par l’équipe")).toBeInTheDocument();
    expect(screen.getByText(`${"x".repeat(120)}…`)).toBeInTheDocument();
  });

  it("sans activité : les messages", () => {
    render(<ActiviteCompte compte={COMPTE} />);
    expect(screen.getByText("Aucune formation commencée.")).toBeInTheDocument();
    expect(screen.getByText("Aucun avis.")).toBeInTheDocument();
  });
});

describe("Fiche d'un compte (page)", () => {
  const ADMIN: Role[] = ["etudiant", "admin"];
  beforeEach(() => {
    getAuthUser.mockResolvedValue({ id: ID2 });
    lireFichesLibres.mockResolvedValue([]);
  });

  it("identifiant inconnu : page introuvable", async () => {
    lireCompte.mockResolvedValue({ migrationAbsente: false, donnees: null });
    await expect(FicheUtilisateur({ params: Promise.resolve({ id: "pas-un-compte" }), roles: ADMIN })).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("avant la migration 0013 : le bandeau", async () => {
    lireCompte.mockResolvedValue({ migrationAbsente: true });
    avecToast(await FicheUtilisateur({ params: Promise.resolve({ id: ID }), roles: ADMIN }));
    expect(screen.getByText(/Appliquez la migration 0013/)).toBeInTheDocument();
  });

  it("un admin voit l'identité, les rôles en lecture seule et peut suspendre un étudiant", async () => {
    lireCompte.mockResolvedValue({ migrationAbsente: false, donnees: COMPTE });
    avecToast(await FicheUtilisateur({ params: Promise.resolve({ id: ID }), roles: ADMIN }));
    expect(screen.getByRole("heading", { level: 1, name: "Fifamè Adjovi" })).toBeInTheDocument();
    expect(screen.getByText("fifame@exemple.com")).toBeInTheDocument();
    expect(screen.getByText("Seul le super admin change les rôles.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suspendre le compte" })).toBeInTheDocument();
    expect(lireFichesLibres).not.toHaveBeenCalled();
  });

  it("les remarques des formateurs, en lecture seule ; aucune ; rien avant la migration 0015", async () => {
    lireCompte.mockResolvedValue({ migrationAbsente: false, donnees: COMPTE });
    lireRemarquesFormateurs.mockResolvedValueOnce({
      migrationAbsente: false,
      donnees: [{ formateurNom: "Dr Mireille Adjovi", texte: "A du mal avec les formules.", modifieeLe: "2026-10-13T09:00:00Z" }],
    });
    const premier = avecToast(await FicheUtilisateur({ params: Promise.resolve({ id: ID }), roles: ADMIN }));
    const section = screen.getByRole("region", { name: "Remarques des formateurs" });
    expect(section).toHaveTextContent("Dr Mireille Adjovi");
    expect(section).toHaveTextContent("13 oct. 2026");
    expect(section).toHaveTextContent("A du mal avec les formules.");
    expect(within(section).queryByRole("textbox")).not.toBeInTheDocument();
    premier.unmount();
    const second = avecToast(await FicheUtilisateur({ params: Promise.resolve({ id: ID }), roles: ADMIN }));
    expect(within(screen.getByRole("region", { name: "Remarques des formateurs" })).getByText("Aucune remarque.")).toBeInTheDocument();
    second.unmount();
    lireRemarquesFormateurs.mockResolvedValueOnce({ migrationAbsente: true } as never);
    avecToast(await FicheUtilisateur({ params: Promise.resolve({ id: ID }), roles: ADMIN }));
    expect(screen.queryByRole("region", { name: "Remarques des formateurs" })).not.toBeInTheDocument();
  });

  it("sur son propre compte, pas de bouton de suspension", async () => {
    getAuthUser.mockResolvedValue({ id: ID });
    lireCompte.mockResolvedValue({ migrationAbsente: false, donnees: { ...COMPTE, roles: ["etudiant", "super_admin"] } });
    avecToast(await FicheUtilisateur({ params: Promise.resolve({ id: ID }), roles: ["etudiant", "super_admin"] }));
    expect(screen.queryByRole("button", { name: "Suspendre le compte" })).not.toBeInTheDocument();
    expect(lireFichesLibres).toHaveBeenCalled();
  });
});
