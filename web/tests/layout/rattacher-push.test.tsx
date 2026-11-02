// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Point reporté du lot 5 : un abonnement push renouvelé par le navigateur (nouvelle adresse) est rattaché au compte à la
// visite suivante, une fois par session du navigateur, sans que l'étudiant rallume l'interrupteur.

const { etatDuPush, abonnementCourant, enregistrerAppareil } = vi.hoisted(() => ({
  etatDuPush: vi.fn(),
  abonnementCourant: vi.fn(),
  enregistrerAppareil: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/envois/abonnement-push", () => ({ etatDuPush, abonnementCourant }));
vi.mock("@/lib/envois/actions", () => ({ enregistrerAppareil }));

const { RattacherPush } = await import("@/components/layout/RattacherPush");

const APPAREIL = { adresse: "https://fcm.googleapis.com/fcm/send/nouvelle", p256dh: "p", auth: "a" };

beforeEach(() => {
  window.sessionStorage.clear();
  vi.stubGlobal("Notification", { permission: "granted" });
  etatDuPush.mockReturnValue("possible");
  abonnementCourant.mockResolvedValue(APPAREIL);
  enregistrerAppareil.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Le rattachement du push de cet appareil", () => {
  it("l'abonnement du navigateur est enregistré pour le compte, une seule fois par session", async () => {
    const { unmount } = render(<RattacherPush />);
    await waitFor(() => expect(enregistrerAppareil).toHaveBeenCalledWith(APPAREIL));
    unmount();
    render(<RattacherPush />);
    await new Promise((r) => setTimeout(r, 20));
    expect(enregistrerAppareil).toHaveBeenCalledTimes(1);
  });

  it("rien sans abonnement, sans autorisation, ou si le push n'est pas possible ici", async () => {
    abonnementCourant.mockResolvedValue(null);
    render(<RattacherPush />);
    await new Promise((r) => setTimeout(r, 20));
    window.sessionStorage.clear();
    abonnementCourant.mockResolvedValue(APPAREIL);
    vi.stubGlobal("Notification", { permission: "default" });
    render(<RattacherPush />);
    window.sessionStorage.clear();
    vi.stubGlobal("Notification", { permission: "granted" });
    etatDuPush.mockReturnValue("sans_cle");
    render(<RattacherPush />);
    await new Promise((r) => setTimeout(r, 20));
    expect(enregistrerAppareil).not.toHaveBeenCalled();
  });
});
