// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { fauxSupabase } from "../admin/faux-supabase";

// Renommer et supprimer un compte depuis le back-office (lot 6 A, spec §3) : les droits, les actions du serveur et
// les fenêtres du menu ⋮ et de la fiche.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const { getShellUser } = vi.hoisted(() => ({ getShellUser: vi.fn() }));
vi.mock("@/lib/auth/current-user", () => ({ getShellUser, demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

const { droitsSurCompte } = await import("@/lib/utilisateurs/regles");
const { renommerCompte, supprimerCompte } = await import("@/lib/utilisateurs/actions");
const { FenetresCompte } = await import("@/components/admin/utilisateurs/FenetresCompte");

const ID = "11111111-1111-4111-8111-111111111111";
const MOI = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ roles: ["etudiant", "super_admin"] });
});

describe("Les droits", () => {
  const compte = (roles: string[], id = ID) => ({ id, roles: roles as never, suspendu: false });
  it("renommer : un admin ; un membre de l'équipe, le super admin seul ; supprimer : le super admin, jamais soi-même ni un super admin", () => {
    const admin = { id: MOI, roles: ["etudiant", "admin"] as never };
    const sa = { id: MOI, roles: ["etudiant", "super_admin"] as never };
    expect(droitsSurCompte(admin, compte(["etudiant"]))).toMatchObject({ renommer: true, supprimer: false });
    expect(droitsSurCompte(admin, compte(["etudiant", "moderateur"]))).toMatchObject({ renommer: false });
    expect(droitsSurCompte(sa, compte(["etudiant", "moderateur"]))).toMatchObject({ renommer: true, supprimer: true });
    expect(droitsSurCompte(sa, compte(["etudiant", "super_admin"]))).toMatchObject({ supprimer: false });
    expect(droitsSurCompte(sa, compte(["etudiant", "super_admin"], MOI))).toMatchObject({ supprimer: false });
    expect(droitsSurCompte({ id: MOI, roles: ["etudiant", "moderateur"] as never }, compte(["etudiant"]))).toMatchObject({ renommer: false, supprimer: false });
  });
});

describe("Les actions du serveur", () => {
  it("renommer : la fonction de la base ; son refus s'affiche", async () => {
    expect(await renommerCompte(ID, "Fifamè", "Houéto")).toEqual({ ok: true });
    expect(faux.de("rpc", "renommer_compte")[0].valeurs).toEqual({ p_compte: ID, p_prenom: "Fifamè", p_nom: "Houéto" });
    faux.repondre("rpc.renommer_compte", { error: { code: "P0001", message: "Seul le super admin renomme un membre de l’équipe." } });
    expect(await renommerCompte(ID, "A", "B")).toEqual({ ok: false, message: "Seul le super admin renomme un membre de l’équipe." });
  });

  it("supprimer : les fichiers du compte d'abord, puis le compte, puis les pièces jointes ; un refus s'affiche", async () => {
    faux.repondre("rpc.fichiers_du_compte", { data: { photos: [`${ID}/a.jpg`], rendus: ["r/1.pdf"], messages: ["m/1.png"] } });
    expect(await supprimerCompte(ID, "Demande de la personne")).toEqual({ ok: true });
    expect(faux.appels.map((a) => a.op)).toEqual(["fichiers_du_compte", "remove", "remove", "supprimer_compte", "remove"]);
    expect(faux.de("rpc", "supprimer_compte")[0].valeurs).toEqual({ p_compte: ID, p_motif: "Demande de la personne" });
    expect(faux.de("storage.photos-profil", "remove")[0].valeurs).toEqual([[`${ID}/a.jpg`]]);
    faux.vider();
    faux.repondre("rpc.fichiers_du_compte", { data: { photos: [], rendus: [], messages: [] } });
    faux.repondre("rpc.supprimer_compte", { error: { code: "P0001", message: "Un compte super admin ne se supprime pas." } });
    expect(await supprimerCompte(ID, "x")).toEqual({ ok: false, message: "Un compte super admin ne se supprime pas." });
    getShellUser.mockResolvedValue({ roles: ["etudiant", "admin"] });
    expect(await supprimerCompte(ID, "x")).toEqual({ ok: false, message: "Vous n’avez pas accès à cette partie du back-office." });
  });
});

describe("Les fenêtres", () => {
  const compte = { id: ID, prenom: "Fifamè", nom: "Agossou", nomCourt: "Fifamè Agossou" };
  it("« Modifier le nom » : prérempli, puis l'action avec les nouvelles valeurs", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <FenetresCompte compte={compte} fenetre="renommer" onFenetreChange={vi.fn()} />
      </ToastProvider>,
    );
    const fenetre = screen.getByRole("dialog", { name: "Modifier le nom" });
    const nom = within(fenetre).getByLabelText("Nom");
    expect(within(fenetre).getByLabelText("Prénom")).toHaveValue("Fifamè");
    await user.clear(nom);
    await user.type(nom, "Houéto");
    await user.click(within(fenetre).getByRole("button", { name: "Enregistrer" }));
    expect(faux.de("rpc", "renommer_compte")[0].valeurs).toEqual({ p_compte: ID, p_prenom: "Fifamè", p_nom: "Houéto" });
  });

  it("« Supprimer ce compte ? » : ce qui part, ce qui reste, le motif demandé", async () => {
    const user = userEvent.setup();
    faux.repondre("rpc.fichiers_du_compte", { data: { photos: [], rendus: [], messages: [] } });
    render(
      <ToastProvider>
        <FenetresCompte compte={compte} fenetre="supprimer" onFenetreChange={vi.fn()} />
      </ToastProvider>,
    );
    const fenetre = screen.getByRole("dialog", { name: "Supprimer ce compte ?" });
    expect(fenetre).toHaveTextContent("Le compte de Fifamè Agossou, sa progression, ses publications, ses messages et ses abonnements seront supprimés.");
    expect(fenetre).toHaveTextContent("Ses paiements et ses certificats déjà délivrés restent (les certificats restent vérifiables). Cette action est définitive.");
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer le compte" }));
    expect(await within(fenetre).findByText("Indiquez le motif de la suppression.")).toBeInTheDocument();
    await user.type(within(fenetre).getByLabelText("Motif (visible par l’équipe)"), "Faux compte");
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer le compte" }));
    expect(faux.de("rpc", "supprimer_compte")[0].valeurs).toEqual({ p_compte: ID, p_motif: "Faux compte" });
  });
});
