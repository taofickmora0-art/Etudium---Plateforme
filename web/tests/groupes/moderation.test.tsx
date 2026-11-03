// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { ElementFile, EtatModeration } from "@/lib/moderation/types";

// Les messages des groupes dans la file de modération du back-office (migration 0075) : signalés par les membres ou par
// l'analyse, ils arrivent avec « Garder » et « Supprimer » ; retirés par l'analyse, ils sont dans « Bloquées », avec
// « Rétablir ».

vi.mock("@/lib/moderation/actions", () => ({
  chargerFile: vi.fn(),
  garderContenu: vi.fn(async () => ({ ok: true })),
  supprimerContenu: vi.fn(async () => ({ ok: true })),
  retablirPublication: vi.fn(async () => ({ ok: true })),
  retablirMessageGroupe: vi.fn(async () => ({ ok: true })),
  reglerAnalyse: vi.fn(),
}));
vi.mock("@/lib/moderation/data", () => ({ lireEtatModeration: vi.fn(), lireFileModeration: vi.fn(), lireNombreAExaminer: vi.fn() }));

const actions = await import("@/lib/moderation/actions");
const { PageModeration } = await import("@/components/admin/moderation/PageModeration");

const ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE: ElementFile = {
  type: "message_groupe",
  id: ID,
  publicationId: "",
  lien: `/groupes/general?message=${ID}`,
  espace: { id: null, nom: "Général" },
  auteur: { id: "a1", prenom: "Jules", nom: "Kossou" },
  creeLe: "2026-11-03T13:00:00Z",
  titre: "",
  texte: "Achetez mes cours",
  pieceJointe: null,
  video: null,
  statut: "publiee",
  analyse: null,
  extrait: "Qui a le support du module 2 ?",
  signalements: { nombre: 1, motifs: [{ motif: "spam", nombre: 1 }], details: [{ motif: "spam", precisions: "", par: "Awa K.", le: "2026-11-03T13:05:00Z" }] },
};
const ETAT: EtatModeration = { active: true, cle: true, jeton: "reconnu", derniereAnalyse: null, enAttente: 0 };

function afficher(elements: ElementFile[]) {
  return render(
    <ToastProvider>
      <PageModeration initial={elements} nombre={elements.length} etat={ETAT} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.mocked(actions.garderContenu).mockClear();
  vi.mocked(actions.supprimerContenu).mockClear();
  vi.mocked(actions.retablirMessageGroupe).mockClear();
  vi.mocked(actions.chargerFile).mockReset();
});

describe("Un message de groupe dans la file", () => {
  it("son genre, son groupe, le message cité, la raison ; « Garder » vise le message", async () => {
    const user = userEvent.setup();
    afficher([MESSAGE]);
    const carte = screen.getByRole("article", { name: "Message de groupe de Jules Kossou" });
    expect(within(carte).getByText(/^Groupe Général · /)).toBeInTheDocument();
    expect(within(carte).getByText("En réponse à « Qui a le support du module 2 ? »")).toBeInTheDocument();
    expect(within(carte).getByText(/Signalée par 1 membre/)).toBeInTheDocument();
    expect(within(carte).getByRole("link", { name: "Ouvrir le groupe" })).toHaveAttribute("href", `/groupes/general?message=${ID}`);
    await user.click(within(carte).getByRole("button", { name: "Garder" }));
    expect(actions.garderContenu).toHaveBeenCalledWith({ messageGroupeId: ID });
    expect(await screen.findByText("Contenu gardé")).toBeInTheDocument();
  });

  it("« Supprimer » : confirmé, il vise le message", async () => {
    const user = userEvent.setup();
    afficher([MESSAGE]);
    await user.click(screen.getByRole("button", { name: "Supprimer" }));
    const fenetre = screen.getByRole("dialog", { name: "Supprimer ce contenu ?" });
    expect(fenetre).toHaveTextContent("« Message retiré par la modération » restera affiché à sa place, et son auteur sera prévenu.");
    await user.click(within(fenetre).getByRole("button", { name: "Supprimer" }));
    expect(actions.supprimerContenu).toHaveBeenCalledWith({ messageGroupeId: ID });
  });

  it("retiré par l'analyse, dans « Bloquées » : « Rétablir » le rend visible", async () => {
    const user = userEvent.setup();
    const bloque: ElementFile = { ...MESSAGE, statut: "bloquee", analyse: { decision: "bloquer", categorie: "arnaque", raison: "Promesse de gain" }, signalements: { nombre: 0, motifs: [], details: [] } };
    vi.mocked(actions.chargerFile).mockResolvedValue({ ok: true, elements: [bloque] });
    afficher([]);
    await user.click(screen.getByRole("button", { name: "Bloquées" }));
    const carte = await screen.findByRole("article", { name: "Message de groupe de Jules Kossou" });
    expect(within(carte).getByText(/Analyse automatique : Arnaque — Promesse de gain/)).toBeInTheDocument();
    await user.click(within(carte).getByRole("button", { name: "Rétablir" }));
    expect(actions.retablirMessageGroupe).toHaveBeenCalledWith(ID);
    expect(await screen.findByText("Message rétabli")).toBeInTheDocument();
  });
});
