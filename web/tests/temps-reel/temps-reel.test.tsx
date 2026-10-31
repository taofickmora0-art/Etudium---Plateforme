// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Le temps réel (migration 0044) : l'appli s'abonne, en privé, au sujet de son compte et à celui de la communauté ; chaque
// événement reçu est relayé dans la page (« etudium:temps-reel:<événement> »), que la cloche, les messages et le fil
// écoutent. Après une coupure, la reconnexion fait tout relire (des événements ont pu être manqués).

type Rappel = (...a: unknown[]) => void;
type FauxCanal = { nom: string; options: unknown; ecoutes: Record<string, Rappel>; etat?: Rappel; on: Rappel; subscribe: Rappel };
const canaux: FauxCanal[] = [];
const setAuth = vi.fn(async () => undefined);
const removeChannel = vi.fn(async () => "ok");
let session: { access_token: string; user: { id: string } } | null = { access_token: "jeton", user: { id: "moi" } };
const createClient = vi.fn(() => ({
  auth: { getSession: async () => ({ data: { session } }) },
  realtime: { setAuth },
  channel: (nom: string, options: unknown) => {
    const canal: FauxCanal = {
      nom,
      options,
      ecoutes: {},
      on(_type: unknown, filtre: unknown, rappel: unknown) {
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
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => createClient() }));

const { TempsReel } = await import("@/components/temps-reel/TempsReel");

const recus: string[] = [];
for (const e of ["notification", "message", "publication"]) window.addEventListener(`etudium:temps-reel:${e}`, () => recus.push(e));
const canal = (nom: string) => canaux.find((c) => c.nom === nom)!;
const attendre = () => new Promise((r) => setTimeout(r, 0));

describe("Le temps réel", () => {
  beforeEach(() => {
    canaux.length = 0;
    recus.length = 0;
    setAuth.mockClear();
    removeChannel.mockClear();
    createClient.mockClear();
    session = { access_token: "jeton", user: { id: "moi" } };
  });

  it("s'abonne en privé à son compte et à la communauté, puis relaie chaque événement dans la page", async () => {
    render(<TempsReel />);
    await attendre();
    expect(setAuth).toHaveBeenCalledWith("jeton");
    expect(canaux.map((c) => [c.nom, c.options])).toEqual([
      ["compte:moi", { config: { private: true } }],
      ["communaute", { config: { private: true } }],
    ]);
    canal("compte:moi").ecoutes.notification();
    canal("compte:moi").ecoutes.message();
    canal("communaute").ecoutes.publication();
    expect(recus).toEqual(["notification", "message", "publication"]);
  });

  it("à la reconnexion (pas au premier abonnement), tout est relu", async () => {
    render(<TempsReel />);
    await attendre();
    canal("compte:moi").etat!("SUBSCRIBED");
    canal("communaute").etat!("SUBSCRIBED");
    expect(recus).toEqual([]);
    canal("compte:moi").etat!("CHANNEL_ERROR");
    canal("compte:moi").etat!("SUBSCRIBED");
    canal("communaute").etat!("SUBSCRIBED");
    expect(recus).toEqual(["notification", "message", "publication"]);
  });

  it("sans session (déconnecté) : aucun abonnement", async () => {
    session = null;
    render(<TempsReel />);
    await attendre();
    expect(canaux).toEqual([]);
  });

  it("se désabonne en quittant ; sans configuration Supabase, rien ne casse", async () => {
    const { unmount } = render(<TempsReel />);
    await attendre();
    unmount();
    expect(removeChannel).toHaveBeenCalledTimes(2);
    createClient.mockImplementationOnce(() => {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL est vide");
    });
    expect(() => render(<TempsReel />)).not.toThrow();
  });
});
