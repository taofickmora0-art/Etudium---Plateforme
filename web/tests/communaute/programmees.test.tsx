// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Espace, LotPublications, MoiCommunaute, Publication } from "@/lib/communaute/types";

// Les onglets « Publiées » et « Programmées » sous le champ de publication (spec sondages, quiz et programmation, §5).
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/communaute" }));
vi.mock("@/components/communaute/EditeurTexte", () => import("./editeur-simule"));
vi.mock("@/lib/communaute/actions", () => ({
  chargerFil: vi.fn(),
  reprogrammer: vi.fn(),
  publierPublication: vi.fn(),
  chargerReponses: vi.fn(),
  modifierPublication: vi.fn(),
  supprimerPublication: vi.fn(),
  repondre: vi.fn(),
  aimer: vi.fn(),
  basculerEnregistrement: vi.fn(),
}));
const actions = await import("@/lib/communaute/actions");
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");

const ESPACES: Espace[] = [{ id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true }];
const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const pub = (id: string, o: Partial<Publication> = {}): Publication => ({
  id,
  auteur: { prenom: "Koffi", nom: "Dossou", role: null },
  estMoi: true,
  espace: { id: null, nom: "Général" },
  titre: "",
  texte: `Texte ${id}`,
  pieceJointe: null,
  creeLe: "2026-10-14T13:00:00Z",
  modifiee: false,
  statut: "publiee",
  reactions: 0,
  jAime: false,
  reponses: 0,
  dernieresReponses: [],
  peutSupprimer: true,
  peutSignaler: false,
  apercu: null,
  enregistree: false,
  aimeePar: [],
  video: null,
  ...o,
});
const lot = (...publications: Publication[]): LotPublications => ({ publications, suite: false });
function afficher() {
  render(
    <ToastProvider>
      <PageCommunaute espaces={ESPACES} initial={lot(pub("parue"))} moi={MOI} maintenant="2026-10-14T15:00:00Z" />
    </ToastProvider>,
  );
}

describe("Publiées / Programmées", () => {
  beforeEach(() => {
    for (const f of Object.values(actions)) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
  });

  it("« Publiées » d'abord, avec « Trier par » ; « Programmées » lit les siennes à venir, sans tri", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot(pub("future", { programmee: true, creeLe: "2026-10-16T14:00:00Z" })) });
    afficher();
    const onglets = screen.getByRole("tablist", { name: "Afficher les publications" });
    expect(within(onglets).getAllByRole("tab").map((o) => o.textContent)).toEqual(["Publiées", "Programmées"]);
    expect(screen.getByRole("tab", { name: "Publiées" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Trier par :")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Programmées" }));
    expect(actions.chargerFil).toHaveBeenCalledWith("tous", "programmees", {});
    expect(await screen.findByText("Texte future")).toBeInTheDocument();
    expect(screen.queryByText("Texte parue")).toBeNull();
    expect(screen.queryByText("Trier par :")).toBeNull();
  });

  it("aucune programmée : un état vide qui dit comment faire ; retour à « Publiées »", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot() }).mockResolvedValueOnce({ ok: true, lot: lot(pub("parue")) });
    afficher();
    await user.click(screen.getByRole("tab", { name: "Programmées" }));
    expect(await screen.findByText("Aucune publication programmée")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Publiées" }));
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", "recentes", {});
    expect(await screen.findByText("Texte parue")).toBeInTheDocument();
  });

  it("« Publier maintenant » depuis « Programmées » : elle quitte la liste", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot(pub("future", { programmee: true, creeLe: "2026-10-16T14:00:00Z" })) });
    vi.mocked(actions.reprogrammer).mockResolvedValueOnce({ ok: true });
    afficher();
    await user.click(screen.getByRole("tab", { name: "Programmées" }));
    await screen.findByText("Texte future");
    await user.click(screen.getByRole("button", { name: /Actions sur la publication/ }));
    await user.click(screen.getByRole("menuitem", { name: "Publier maintenant" }));
    await waitFor(() => expect(screen.queryByText("Texte future")).toBeNull());
    expect(screen.getByText("Aucune publication programmée")).toBeInTheDocument();
  });

  it("programmer une publication depuis « Programmées » : la liste se relit", async () => {
    const user = userEvent.setup();
    vi.mocked(actions.chargerFil).mockResolvedValue({ ok: true, lot: lot() });
    vi.mocked(actions.publierPublication).mockResolvedValueOnce({ ok: true, id: "n", statut: "publiee", apercu: null, video: null });
    afficher();
    await user.click(screen.getByRole("tab", { name: "Programmées" }));
    await screen.findByText("Aucune publication programmée");
    await user.click(screen.getByRole("button", { name: "Quoi de neuf, Koffi ?" }));
    await user.type(await screen.findByRole("textbox", { name: "Nouvelle publication" }), "Bientôt");
    await user.click(screen.getByRole("button", { name: "Plus d’options de publication" }));
    await user.click(screen.getByRole("menuitem", { name: "Programmer…" }));
    const fenetre = screen.getByRole("dialog", { name: "Programmer la publication" });
    const jour = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Porto-Novo" }).format(new Date(Date.now() + 2 * 86_400_000));
    fireEvent.change(within(fenetre).getByLabelText("Date"), { target: { value: jour } });
    fireEvent.change(within(fenetre).getByLabelText("Heure"), { target: { value: "15:00" } });
    await user.click(within(fenetre).getByRole("button", { name: "Programmer" }));
    await user.click(screen.getByRole("button", { name: "Programmer" }));
    await waitFor(() => expect(actions.chargerFil).toHaveBeenCalledTimes(2));
    expect(actions.chargerFil).toHaveBeenLastCalledWith("tous", "programmees", {});
  });
});
