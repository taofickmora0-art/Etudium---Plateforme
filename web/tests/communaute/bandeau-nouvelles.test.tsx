// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Espace, LotPublications, MoiCommunaute, Publication } from "@/lib/communaute/types";

// Le bandeau « Nouvelles publications » (liste du 31 octobre 2026, tâche 9) : le fil « Les plus récentes » demande toutes
// les 30 s (et au retour sur l'onglet) ce qui est paru depuis sa plus récente ; un appui relit le fil, sans recharger.
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({ upload: vi.fn(), remove: vi.fn() }) } }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), useSearchParams: () => new URLSearchParams(), usePathname: () => "/accueil" }));
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
  masquerAnnonce: vi.fn(),
}));
vi.mock("@/lib/communaute/nouvelles", () => ({ compterNouvellesPublications: vi.fn() }));
const actions = await import("@/lib/communaute/actions");
const { compterNouvellesPublications: compter } = await import("@/lib/communaute/nouvelles");
const { PageCommunaute } = await import("@/components/communaute/PageCommunaute");

const ESPACES: Espace[] = [{ id: null, nom: "Général", nomCourt: "Général", couleur: null, slug: null, ouvert: true }];
const MOI: MoiCommunaute = { compteId: "moi", prenom: "Koffi", nom: "Dossou", initiales: "KD", photoUrl: null };
const pub = (id: string, creeLe: string): Publication => ({
  id,
  auteur: { prenom: "Awa", nom: "Kpadé", role: null },
  estMoi: false,
  espace: { id: null, nom: "Général" },
  titre: "",
  texte: `Texte ${id}`,
  pieceJointe: null,
  creeLe,
  modifiee: false,
  statut: "publiee",
  reactions: 0,
  jAime: false,
  reponses: 0,
  dernieresReponses: [],
  peutSupprimer: false,
  peutSignaler: true,
  apercu: null,
  enregistree: false,
  aimeePar: [],
  video: null,
});
const lot = (...publications: Publication[]): LotPublications => ({ publications, suite: false });
const afficher = (initial: LotPublications) =>
  render(
    <ToastProvider>
      <PageCommunaute espaces={ESPACES} initial={initial} moi={MOI} maintenant="2026-10-14T15:00:00Z" />
    </ToastProvider>,
  );
const attendre = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const bandeau = () => screen.queryByRole("button", { name: /nouvelles? publications?$/ });
const visibilite = (etat: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { value: etat, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("Le bandeau « Nouvelles publications »", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    for (const f of [...Object.values(actions), compter]) vi.mocked(f as (...a: unknown[]) => unknown).mockReset();
    vi.mocked(compter).mockResolvedValue({ nombre: 0, auteurs: [] });
    Element.prototype.scrollIntoView = vi.fn();
    visibilite("visible");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toutes les 30 s, le fil demande ce qui est paru depuis sa plus récente ; un appui relit le fil, et le bandeau s'en va", async () => {
    afficher(lot(pub("a", "2026-10-14T13:00:00Z"), pub("b", "2026-10-14T12:00:00Z")));
    expect(compter).not.toHaveBeenCalled();
    vi.mocked(compter).mockResolvedValue({ nombre: 2, auteurs: [{ initiales: "AK", photoUrl: null }, { initiales: "RH", photoUrl: null }] });
    await attendre(30_000);
    expect(compter).toHaveBeenCalledWith("tous", "2026-10-14T13:00:00Z");
    expect(bandeau()).toHaveAccessibleName("2 nouvelles publications");

    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: true, lot: lot(pub("c", "2026-10-14T14:00:00Z"), pub("a", "2026-10-14T13:00:00Z")) });
    vi.mocked(compter).mockClear().mockResolvedValue({ nombre: 0, auteurs: [] });
    fireEvent.click(bandeau()!);
    expect(bandeau()).toBeNull();
    expect(actions.chargerFil).toHaveBeenCalledWith("tous", "recentes", {});
    expect(await screen.findByText("Texte c")).toBeInTheDocument();
    expect(screen.queryByText("Texte b")).toBeNull();
    // La suivante part de la nouvelle plus récente.
    await attendre(30_000);
    expect(compter).toHaveBeenCalledWith("tous", "2026-10-14T14:00:00Z");
    expect(bandeau()).toBeNull();
  });

  it("une seule : au singulier ; un fil vide demande tout ce qui est paru", async () => {
    afficher(lot());
    vi.mocked(compter).mockResolvedValue({ nombre: 1, auteurs: [{ initiales: "AK", photoUrl: null }] });
    await attendre(30_000);
    expect(compter).toHaveBeenCalledWith("tous", null);
    expect(bandeau()).toHaveAccessibleName("1 nouvelle publication");
  });

  it("onglet caché : rien ; au retour, une vérification tout de suite", async () => {
    afficher(lot(pub("a", "2026-10-14T13:00:00Z")));
    visibilite("hidden");
    await attendre(60_000);
    expect(compter).not.toHaveBeenCalled();
    visibilite("visible");
    await attendre(0);
    expect(compter).toHaveBeenCalledTimes(1);
  });

  it("« Programmées » : aucune vérification", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    afficher(lot(pub("a", "2026-10-14T13:00:00Z")));
    vi.mocked(actions.chargerFil).mockResolvedValue({ ok: true, lot: lot() });
    await user.click(screen.getByRole("tab", { name: /Programmées/ }));
    await attendre(60_000);
    expect(compter).not.toHaveBeenCalled();
  });

  it("le temps réel (0044) : une publication paraît, la vérification part aussitôt, sans attendre les 30 s", async () => {
    afficher(lot(pub("a", "2026-10-14T13:00:00Z")));
    vi.mocked(compter).mockResolvedValue({ nombre: 1, auteurs: [] });
    act(() => {
      window.dispatchEvent(new Event("etudium:temps-reel:publication"));
    });
    await attendre(1_000);
    expect(compter).toHaveBeenCalledTimes(1);
    expect(bandeau()).toHaveAccessibleName("1 nouvelle publication");
  });

  it("une relecture qui échoue : un message, le fil reste", async () => {
    afficher(lot(pub("a", "2026-10-14T13:00:00Z")));
    vi.mocked(compter).mockResolvedValue({ nombre: 3, auteurs: [] });
    await attendre(30_000);
    vi.mocked(actions.chargerFil).mockResolvedValueOnce({ ok: false, message: "Les publications n’ont pas pu être chargées. Réessayez." });
    fireEvent.click(bandeau()!);
    expect(await screen.findByText("Les publications n’ont pas pu être chargées. Réessayez.")).toBeInTheDocument();
    expect(screen.getByText("Texte a")).toBeInTheDocument();
  });
});
