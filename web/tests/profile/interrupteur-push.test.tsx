// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterrupteurPush } from "@/components/profile/InterrupteurPush";
import { enregistrerAppareil, retirerAppareil } from "@/lib/envois/actions";

// L'interrupteur « Notifications push » du profil (lot 5, étape B) : il demande l'autorisation, abonne cet appareil et
// l'enregistre ; éteint, il le désabonne et le retire. Il dit pourquoi le push n'est pas possible.

vi.mock("@/lib/envois/actions", () => ({ enregistrerAppareil: vi.fn(), retirerAppareil: vi.fn() }));

const CLE = "B" + "A".repeat(86);
const ADRESSE = "https://push.exemple/abc";
const REFUS = "Autorisez les notifications pour Étudium dans les réglages du navigateur.";

type Options = { permission?: NotificationPermission; reponse?: NotificationPermission; abonne?: boolean; push?: boolean; ua?: string; installe?: boolean };

function abonnement() {
  return { endpoint: ADRESSE, toJSON: () => ({ endpoint: ADRESSE, keys: { p256dh: "cle-p256dh", auth: "cle-auth" } }), unsubscribe: vi.fn(async () => true), options: {} };
}

function navigateur({ permission = "default", reponse = "granted", abonne = false, push = true, ua = "Mozilla/5.0 (Linux; Android 14)", installe = false }: Options = {}) {
  let courant: ReturnType<typeof abonnement> | null = abonne ? abonnement() : null;
  const pushManager = {
    getSubscription: vi.fn(async () => courant),
    subscribe: vi.fn(async () => (courant = abonnement())),
  };
  const enregistrement = { pushManager };
  const notification = {
    permission,
    requestPermission: vi.fn(async () => {
      notification.permission = reponse;
      return reponse;
    }),
  };
  vi.stubGlobal("Notification", notification);
  if (push) vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(window.navigator, "serviceWorker", {
    configurable: true,
    value: { register: vi.fn(async () => enregistrement), ready: Promise.resolve(enregistrement), getRegistration: vi.fn(async () => enregistrement) },
  });
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: ua });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: installe })));
  return { pushManager, notification, courant: () => courant };
}

const interrupteur = () => screen.getByRole("switch", { name: "Notifications push" });

/** Le parent (l'onglet Notifications) garde la préférence. */
function Controle({ depart, onChange }: { depart: boolean; onChange: (v: boolean) => void }) {
  const [actif, setActif] = useState(depart);
  return (
    <InterrupteurPush
      actif={actif}
      onChange={(v) => {
        setActif(v);
        onChange(v);
      }}
    />
  );
}

beforeEach(() => {
  vi.mocked(enregistrerAppareil).mockReset().mockResolvedValue({ ok: true });
  vi.mocked(retirerAppareil).mockReset().mockResolvedValue({ ok: true });
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", CLE);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  // @ts-expect-error retirée après chaque test
  delete window.navigator.serviceWorker;
});

describe("L'interrupteur des notifications push", () => {
  it("sans clé publique : « Bientôt disponible », désactivé", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    navigateur();
    render(<InterrupteurPush actif onChange={vi.fn()} />);
    await waitFor(() => expect(interrupteur()).toHaveAccessibleDescription("Bientôt disponible"));
    expect(interrupteur()).toBeDisabled();
  });

  it("navigateur sans push ; iPhone sans l'appli installée ; autorisation refusée : chacun son message, désactivé", async () => {
    navigateur({ push: false });
    const { unmount } = render(<InterrupteurPush actif onChange={vi.fn()} />);
    await waitFor(() => expect(interrupteur()).toHaveAccessibleDescription("Votre navigateur ne reçoit pas les notifications push."));
    expect(interrupteur()).toBeDisabled();
    unmount();

    navigateur({ push: false, ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)" });
    const second = render(<InterrupteurPush actif onChange={vi.fn()} />);
    await waitFor(() =>
      expect(interrupteur()).toHaveAccessibleDescription("Sur iPhone, ajoutez d’abord Étudium à l’écran d’accueil (Partager › Sur l’écran d’accueil)."),
    );
    second.unmount();

    navigateur({ permission: "denied" });
    render(<InterrupteurPush actif onChange={vi.fn()} />);
    await waitFor(() => expect(interrupteur()).toHaveAccessibleDescription(REFUS));
    expect(interrupteur()).toBeDisabled();
  });

  it("activer : autorisation, abonnement avec la clé, enregistrement de l'appareil, puis la préférence", async () => {
    const n = navigateur();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controle depart={false} onChange={onChange} />);
    await waitFor(() => expect(interrupteur()).toBeEnabled());
    expect(interrupteur()).not.toBeChecked();
    expect(interrupteur()).toHaveAccessibleDescription("Sur cet appareil");
    await user.click(interrupteur());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(n.notification.requestPermission).toHaveBeenCalled();
    const options = n.pushManager.subscribe.mock.calls[0] as unknown as [{ userVisibleOnly: boolean; applicationServerKey: Uint8Array }];
    expect(options[0].userVisibleOnly).toBe(true);
    expect(options[0].applicationServerKey).toHaveLength(65);
    expect(enregistrerAppareil).toHaveBeenCalledWith({ adresse: ADRESSE, p256dh: "cle-p256dh", auth: "cle-auth" });
    expect(interrupteur()).toBeChecked();
  });

  it("cet appareil abonné et la préférence active : allumé ; éteindre désabonne et retire l'appareil", async () => {
    const n = navigateur({ permission: "granted", abonne: true });
    const abonnementCourant = n.courant()!;
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Controle depart onChange={onChange} />);
    await waitFor(() => expect(interrupteur()).toBeChecked());
    await user.click(interrupteur());
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
    expect(abonnementCourant.unsubscribe).toHaveBeenCalled();
    expect(retirerAppareil).toHaveBeenCalledWith(ADRESSE);
    expect(interrupteur()).not.toBeChecked();
  });

  it("préférence active mais cet appareil pas abonné : éteint (il ne reçoit rien)", async () => {
    navigateur({ permission: "granted" });
    render(<InterrupteurPush actif onChange={vi.fn()} />);
    await waitFor(() => expect(interrupteur()).toBeEnabled());
    expect(interrupteur()).not.toBeChecked();
  });

  it("autorisation refusée à la demande : le message du refus, rien d'enregistré", async () => {
    navigateur({ reponse: "denied" });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<InterrupteurPush actif={false} onChange={onChange} />);
    await waitFor(() => expect(interrupteur()).toBeEnabled());
    await user.click(interrupteur());
    await waitFor(() => expect(interrupteur()).toHaveAccessibleDescription(REFUS));
    expect(enregistrerAppareil).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("l'enregistrement échoue : l'appareil est désabonné, le message s'affiche, l'interrupteur reste éteint", async () => {
    const n = navigateur();
    vi.mocked(enregistrerAppareil).mockResolvedValue({ ok: false, message: "Appliquez la migration 0058." });
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<InterrupteurPush actif={false} onChange={onChange} />);
    await waitFor(() => expect(interrupteur()).toBeEnabled());
    await user.click(interrupteur());
    expect(await screen.findByRole("alert")).toHaveTextContent("Appliquez la migration 0058.");
    expect(n.courant()?.unsubscribe).toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(interrupteur()).not.toBeChecked();
  });
});
