// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { CorrectionAFaire, RenduACorriger, VersionRendu } from "@/lib/exercices/types";

// Lot 3, étape B : la page « Corrections » du formateur et de l'équipe (NdCorrection, NdCorrectionDemande,
// NdCorrectionValidation).
vi.mock("@/lib/exercices/actions", () => ({ corrigerRendu: vi.fn(), lienRendu: vi.fn() }));
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));
const { corrigerRendu, lienRendu } = await import("@/lib/exercices/actions");
const { ListeCorrections } = await import("@/components/corrections/ListeCorrections");
const { CorrectionRendu } = await import("@/components/corrections/CorrectionRendu");
const { MENUS } = await import("@/lib/navigation");

const R = "22222222-2222-4222-8222-222222222222";
const CORRECTION: CorrectionAFaire = {
  renduId: R,
  etudiant: "Aïcha Kpadé",
  exercice: "Tableau des ventes",
  formation: "Maîtriser Excel",
  formationId: "f1",
  module: "Analyse",
  moduleRang: 3,
  version: 2,
  nomFichier: "v2.xlsx",
  deposeLe: new Date(Date.now() - 20 * 60_000).toISOString(),
};
const version = (o: Partial<VersionRendu> = {}): VersionRendu => ({
  id: R,
  version: 2,
  nomFichier: "tableau-ventes-v2.xlsx",
  format: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  tailleOctets: 142000,
  message: "J’ai ajouté le filtre par produit.",
  statut: "en_attente",
  remarque: "",
  correcteur: null,
  corrigeLe: null,
  creeLe: new Date(Date.now() - 20 * 60_000).toISOString(),
  aUnFichier: true,
  ...o,
});
const RENDU: RenduACorriger = {
  etudiant: "Aïcha Kpadé",
  exercice: { id: "e1", titre: "Tableau des ventes", genre: "rendu", consigne: "Créez un tableau croisé dynamique." },
  formation: { id: "f1", titre: "Maîtriser Excel", slug: "excel" },
  module: { titre: "Analyse", rang: 3 },
  version: version(),
  derniere: true,
  historique: [version(), version({ id: "v1", version: 1, statut: "a_corriger", remarque: "Il manque le filtre.", correcteur: "Mireille Adjovi", message: "" })],
  suivant: null,
};
const afficher = (rendu: RenduACorriger = RENDU) =>
  render(
    <ToastProvider>
      <CorrectionRendu rendu={rendu} />
    </ToastProvider>,
  );

beforeEach(() => {
  vi.mocked(corrigerRendu).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(lienRendu).mockReset();
  refresh.mockReset();
});

describe("La liste des corrections", () => {
  it("chaque travail en attente mène à sa correction ; vide, un message", () => {
    const { unmount } = render(<ListeCorrections corrections={[CORRECTION]} base="/formateur/corrections" />);
    const lien = screen.getByRole("link", { name: /Aïcha Kpadé/ });
    expect(lien).toHaveAttribute("href", `/formateur/corrections/${R}`);
    expect(lien).toHaveTextContent("Tableau des ventes · Maîtriser Excel, module 3");
    expect(lien).toHaveTextContent("Version 2 · il y a 20 min");
    unmount();
    render(<ListeCorrections corrections={[]} base="/admin/corrections" />);
    expect(screen.getByText("Aucun travail à corriger")).toBeInTheDocument();
  });

  it("l'équipe a sa page « Corrections » dans le back-office", () => {
    const entrees = MENUS.admin.groupes.flatMap((g) => g.entrees);
    expect(entrees.find((e) => e.href === "/admin/corrections")).toMatchObject({ label: "Corrections" });
  });
});

describe("Corriger un travail", () => {
  it("le travail, le message, le fichier à télécharger, la consigne et l'historique", async () => {
    const user = userEvent.setup();
    vi.mocked(lienRendu).mockResolvedValue({ erreur: "Ce fichier n’est pas accessible." });
    afficher();
    const travail = screen.getByRole("region", { name: "Travail rendu" });
    expect(travail).toHaveTextContent("Aïcha Kpadé");
    expect(travail).toHaveTextContent("Version 2, déposée il y a 20 min");
    expect(travail).toHaveTextContent("Message de l’étudiant");
    expect(travail).toHaveTextContent("J’ai ajouté le filtre par produit.");
    await user.click(within(travail).getByRole("button", { name: "Télécharger tableau-ventes-v2.xlsx" }));
    expect(lienRendu).toHaveBeenCalledWith(R);
    expect(screen.getByRole("region", { name: "Consigne" })).toHaveTextContent("Créez un tableau croisé dynamique.");
    expect(within(screen.getByRole("list", { name: "Historique des rendus" })).getAllByRole("listitem")).toHaveLength(2);
  });

  it("« Demander une correction » exige une remarque ; « Envoyer la demande » ; « Remarque envoyée »", async () => {
    const user = userEvent.setup();
    afficher();
    await user.click(screen.getByRole("button", { name: "Demander une correction" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Expliquez ce qu’il faut corriger.");
    expect(screen.queryByRole("dialog")).toBeNull();
    // Le champ est signalé et reprend le focus.
    expect(screen.getByRole("textbox", { name: "Remarque pour l’étudiant" })).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("textbox", { name: "Remarque pour l’étudiant" })).toHaveFocus();
    await user.type(screen.getByRole("textbox", { name: "Remarque pour l’étudiant" }), "Ajoutez le filtre par produit.");
    await user.click(screen.getByRole("button", { name: "Demander une correction" }));
    const fenetre = screen.getByRole("dialog", { name: "Demander une correction ?" });
    expect(fenetre).toHaveTextContent("L’étudiant pourra déposer une nouvelle version de son travail.");
    await user.click(within(fenetre).getByRole("button", { name: "Envoyer la demande" }));
    await waitFor(() => expect(corrigerRendu).toHaveBeenCalledWith(R, "a_corriger", "Ajoutez le filtre par produit."));
    expect(await screen.findByText("Remarque envoyée")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("« Valider l'exercice » (commentaire facultatif) ; un refus reste dans la fenêtre", async () => {
    const user = userEvent.setup();
    vi.mocked(corrigerRendu).mockResolvedValueOnce({ ok: false, message: "Ce travail a déjà été corrigé." });
    afficher();
    await user.click(screen.getByRole("button", { name: "Valider l’exercice" }));
    const fenetre = screen.getByRole("dialog", { name: "Valider cet exercice ?" });
    expect(fenetre).toHaveTextContent("L’étudiant sera prévenu.");
    expect(fenetre).not.toHaveTextContent("débloqué");
    await user.click(within(fenetre).getByRole("button", { name: "Valider l’exercice" }));
    expect(await within(fenetre).findByText("Ce travail a déjà été corrigé.")).toBeInTheDocument();
    await user.click(within(fenetre).getByRole("button", { name: "Valider l’exercice" }));
    await waitFor(() => expect(corrigerRendu).toHaveBeenLastCalledWith(R, "valide", ""));
    expect(await screen.findByText("Exercice validé")).toBeInTheDocument();
  });

  it("corrigé (la page relue) : le focus passe au titre « Votre retour »", () => {
    const { rerender } = afficher();
    rerender(
      <ToastProvider>
        <CorrectionRendu rendu={{ ...RENDU, version: version({ statut: "valide" }) }} />
      </ToastProvider>,
    );
    expect(screen.getByRole("heading", { name: "Votre retour" })).toHaveFocus();
  });

  it("un travail déjà corrigé, ou une ancienne version : plus de boutons", () => {
    const { unmount } = afficher({ ...RENDU, version: version({ statut: "valide", remarque: "Bravo", correcteur: "Mireille Adjovi" }) });
    expect(screen.getByText("Ce travail a déjà été corrigé.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Valider l’exercice" })).toBeNull();
    unmount();
    afficher({ ...RENDU, derniere: false });
    expect(screen.getByText("Une version plus récente de ce travail existe.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Demander une correction" })).toBeNull();
  });
});
