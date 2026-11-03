// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeGroupe } from "@/lib/groupes/types";

// L'entrée « Groupes » du menu (migration 0075) : la pastille du total des non-lus (groupes actifs, non coupés), sur
// ordinateur et sur le bouton ≡ du téléphone, tenue à jour par le temps réel ; et l'abonnement aux sujets « groupe:<id> ».

let chemin = "/accueil";
vi.mock("next/navigation", () => ({ usePathname: () => chemin, useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/notifications/actions", () => ({ chargerCloche: async () => null, marquerLues: async () => ({ ok: true }) }));
vi.mock("@/lib/communaute/actions", () => ({ chargerEspaces: async () => ({ ok: true, espaces: [] }) }));
const compterMessagesNonLus = vi.fn(async () => 0);
vi.mock("@/lib/messages/actions", () => ({ compterMessagesNonLus: () => compterMessagesNonLus() }));
const chargerMesGroupes = vi.fn();
vi.mock("@/lib/groupes/actions", () => ({ chargerMesGroupes: () => chargerMesGroupes() }));

type Rappel = (...a: unknown[]) => void;
type FauxCanal = { nom: string; options: unknown; ecoutes: Record<string, Rappel>; etat?: Rappel; on: Rappel; subscribe: Rappel };
const canaux: FauxCanal[] = [];
const removeChannel = vi.fn(async () => "ok");
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { getSession: async () => ({ data: { session: { access_token: "jeton", user: { id: "moi" } } } }) },
    realtime: { setAuth: async () => undefined },
    channel: (nom: string, options: unknown) => {
      const canal: FauxCanal = {
        nom,
        options,
        ecoutes: {},
        on(_t: unknown, filtre: unknown, rappel: unknown) {
          canal.ecoutes[(filtre as { event: string }).event] = rappel as Rappel;
          return canal;
        },
        subscribe(etat: unknown) {
          canal.etat = etat as Rappel;
          return canal;
        },
      };
      canaux.push(canal);
      return canal;
    },
    removeChannel,
  }),
}));

const { SidebarNavLinks } = await import("@/components/layout/SidebarNav");
const { MenuTiroir } = await import("@/components/layout/MenuTiroir");
const { TempsReelGroupes } = await import("@/components/temps-reel/TempsReelGroupes");
const { reinitialiserGroupesNonLus } = await import("@/components/groupes/useGroupesNonLus");
const { reinitialiserMessagesNonLus } = await import("@/components/messages/useMessagesNonLus");
const { reinitialiserGroupesSuivis, suivreGroupes } = await import("@/components/temps-reel/groupes");

const G1 = "11111111-1111-4111-8111-111111111111";
const G2 = "22222222-2222-4222-8222-222222222222";
const G3 = "33333333-3333-4333-8333-333333333333";
const resume = (id: string, nonLus: number, o: Partial<ResumeGroupe> = {}): ResumeGroupe => ({ id, slug: id, nom: id, type: "parcours", couleur: null, actif: true, nonLus, coupe: false, dernier: null, ...o });

beforeEach(() => {
  chemin = "/accueil";
  canaux.length = 0;
  removeChannel.mockClear();
  chargerMesGroupes.mockReset().mockResolvedValue({ ok: true, groupes: [resume(G1, 3), resume(G2, 5, { coupe: true }), resume(G3, 1)] });
  compterMessagesNonLus.mockReset().mockResolvedValue(0);
});
afterEach(() => {
  reinitialiserGroupesNonLus();
  reinitialiserMessagesNonLus();
  reinitialiserGroupesSuivis();
  vi.useRealTimers();
});

describe("La pastille de l'entrée « Groupes »", () => {
  it("étudiant : le total des groupes non coupés, et l'entrée après « Messages »", async () => {
    render(<SidebarNavLinks pathname="/accueil" />);
    const lien = await screen.findByRole("link", { name: /Groupes/ });
    expect(lien).toHaveAttribute("href", "/groupes");
    await waitFor(() => expect(lien).toHaveAccessibleName(/4 messages non lus dans les groupes/));
  });

  it("formateur : dans son espace", async () => {
    chemin = "/formateur";
    render(<SidebarNavLinks pathname="/formateur" />);
    const lien = await screen.findByRole("link", { name: /Groupes/ });
    expect(lien).toHaveAttribute("href", "/formateur/groupes");
    await waitFor(() => expect(lien).toHaveAccessibleName(/4 messages non lus dans les groupes/));
  });

  it("le back-office : ni entrée ni lecture", () => {
    render(<SidebarNavLinks pathname="/admin" />);
    expect(screen.queryByRole("link", { name: /Groupes/ })).not.toBeInTheDocument();
    expect(chargerMesGroupes).not.toHaveBeenCalled();
  });

  it("un message arrive dans l'un des groupes : la pastille se relit", async () => {
    render(<SidebarNavLinks pathname="/accueil" />);
    const lien = await screen.findByRole("link", { name: /Groupes/ });
    await waitFor(() => expect(lien).toHaveAccessibleName(/4 messages/));
    chargerMesGroupes.mockResolvedValue({ ok: true, groupes: [resume(G1, 9)] });
    vi.useFakeTimers();
    act(() => window.dispatchEvent(new CustomEvent("etudium:temps-reel:groupe", { detail: { groupe: G1, evenement: "message" } })));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    vi.useRealTimers();
    await waitFor(() => expect(lien).toHaveAccessibleName(/9 messages non lus dans les groupes/));
  });

  it("sur le téléphone, le bouton ≡ additionne conversations et messages des groupes", async () => {
    compterMessagesNonLus.mockResolvedValue(2);
    render(<MenuTiroir />);
    const bouton = screen.getByRole("button", { name: "Menu" });
    await waitFor(() => expect(bouton).toHaveAccessibleDescription("2 conversations non lues, 4 messages non lus dans les groupes"));
    expect(within(bouton.parentElement!).getByText("6")).toBeInTheDocument();
  });
});

describe("Le temps réel des groupes", () => {
  it("un sujet privé par groupe suivi ; chaque événement est relayé dans la page ; la reconnexion fait relire", async () => {
    const recus: string[] = [];
    const ecouter = (e: Event) => recus.push(`${(e as CustomEvent).detail.groupe}:${(e as CustomEvent).detail.evenement}`);
    window.addEventListener("etudium:temps-reel:groupe", ecouter);
    act(() => suivreGroupes("essai", [G2, G1]));
    const { unmount } = render(<TempsReelGroupes />);
    await waitFor(() => expect(canaux.map((c) => [c.nom, c.options])).toEqual([
      [`groupe:${G1}`, { config: { private: true } }],
      [`groupe:${G2}`, { config: { private: true } }],
    ]));
    canaux[0].ecoutes.message();
    canaux[1].ecoutes.changement();
    canaux[0].etat!("SUBSCRIBED");
    canaux[0].etat!("CHANNEL_ERROR");
    canaux[0].etat!("SUBSCRIBED");
    expect(recus).toEqual([`${G1}:message`, `${G2}:changement`, `${G1}:message`]);
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(2);
    window.removeEventListener("etudium:temps-reel:groupe", ecouter);
  });

  it("aucun groupe suivi : aucun abonnement", async () => {
    render(<TempsReelGroupes />);
    await new Promise((r) => setTimeout(r, 0));
    expect(canaux).toEqual([]);
  });
});
