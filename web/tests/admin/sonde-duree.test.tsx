// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// La sonde de durée de l'éditeur (revue) : TikTok et Tella ne donnent la durée qu'en lecture ; arrondie vers le bas ;
// le lecteur caché est détruit, durée lue ou abandon.
const creerAdaptateur = vi.fn();
vi.mock("@/lib/video/adaptateurs", () => ({ creerAdaptateur: (...a: unknown[]) => creerAdaptateur(...a) }));
const { SondeDureeVideo } = await import("@/components/admin/SondeDureeVideo");

const faux = (duree: () => number) => ({ duree: vi.fn(async () => duree()), lire: vi.fn(), setMuet: vi.fn(), detruire: vi.fn() });

describe("La sonde de durée", () => {
  beforeEach(() => creerAdaptateur.mockReset());

  it("pas de durée avant la lecture : la vidéo est lancée sans le son, la durée lue (arrondie vers le bas), le lecteur détruit", async () => {
    let lancee = false;
    const a = faux(() => (lancee ? 95.8 : 0));
    a.lire.mockImplementation(() => {
      lancee = true;
    });
    creerAdaptateur.mockResolvedValue(a);
    const onDuree = vi.fn();
    render(<SondeDureeVideo video={{ fournisseur: "tella", id: "mon-cours-a1b2" }} onDuree={onDuree} />);
    await waitFor(() => expect(onDuree).toHaveBeenCalledWith(95), { timeout: 3000 });
    expect(a.setMuet).toHaveBeenCalledWith(true);
    expect(a.detruire).toHaveBeenCalled();
  });

  it("abandon : le lecteur caché est détruit, l'éditeur est prévenu ; il ne prend jamais le focus", async () => {
    vi.useFakeTimers();
    const a = faux(() => 0);
    creerAdaptateur.mockResolvedValue(a);
    const onEchec = vi.fn();
    const { container } = render(<SondeDureeVideo video={{ fournisseur: "tiktok", id: "7234567890123456789" }} onDuree={vi.fn()} onEchec={onEchec} />);
    expect(container.firstElementChild).toHaveAttribute("inert");
    await vi.advanceTimersByTimeAsync(25_000);
    expect(onEchec).toHaveBeenCalled();
    expect(a.detruire).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
