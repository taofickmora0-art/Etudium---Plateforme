// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demandeInstallation, NAVIGATEURS, retablirNavigateur, simulerNavigateur } from "./simuler-navigateur";

// « Installer l'application » (demande du 3 novembre 2026) : la demande d'installation de Chrome est gardée dès le
// chargement de l'espace connecté, puis le menu du profil la propose. Le magasin vit dans un module : chaque test le
// recharge à neuf.

async function charger() {
  vi.resetModules();
  const installation = await import("@/lib/pwa/installation");
  const { CapterInstallation } = await import("@/components/installation/CapterInstallation");
  function Etat() {
    return <p data-testid="etat">{installation.useInstallation()}</p>;
  }
  return { installation, CapterInstallation, Etat };
}

async function monter() {
  const chargement = await charger();
  const { CapterInstallation, Etat } = chargement;
  render(
    <>
      <CapterInstallation />
      <Etat />
    </>,
  );
  return chargement;
}

const etat = () => screen.getByTestId("etat").textContent;

afterEach(() => {
  retablirNavigateur();
  // @ts-expect-error retiré après le test
  delete window.navigator.serviceWorker;
});

describe("Installer l'application : l'état", () => {
  it("Chrome : la demande d'installation est gardée (sans sa bannière) et l'appli devient installable", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeAndroid });
    await monter();
    expect(etat()).toBe("indisponible");
    const demande = demandeInstallation();
    act(() => {
      window.dispatchEvent(demande);
    });
    expect(demande.defaultPrevented).toBe(true);
    expect(etat()).toBe("installable");
  });

  it("installer() ouvre la fenêtre de Chrome ; acceptée, l'appli est installée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeOrdinateur });
    const { installation } = await monter();
    const demande = demandeInstallation("accepted");
    act(() => {
      window.dispatchEvent(demande);
    });
    let issue: string | undefined;
    await act(async () => {
      issue = await installation.installer();
    });
    expect(demande.prompt).toHaveBeenCalledOnce();
    expect(issue).toBe("acceptee");
    expect(etat()).toBe("installee");
  });

  it("refusée : la demande ne resert pas (Chrome n'en permet qu'une) ; plus rien à proposer", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeAndroid });
    const { installation } = await monter();
    const demande = demandeInstallation("dismissed");
    act(() => {
      window.dispatchEvent(demande);
    });
    let issue: string | undefined;
    await act(async () => {
      issue = await installation.installer();
    });
    expect(issue).toBe("refusee");
    expect(etat()).toBe("indisponible");
    await act(async () => {
      issue = await installation.installer();
    });
    expect(issue).toBe("indisponible");
    expect(demande.prompt).toHaveBeenCalledOnce();
  });

  it("déjà ouverte comme une appli (display-mode: standalone) : installée, même si Chrome envoie une demande", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeAndroid, autonome: true });
    await monter();
    act(() => {
      window.dispatchEvent(demandeInstallation());
    });
    expect(etat()).toBe("installee");
  });

  it("iPhone ouvert depuis l'écran d'accueil (navigator.standalone) : installée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.safariIphone, toucher: 5, standalone: true });
    await monter();
    expect(etat()).toBe("installee");
  });

  it("l'événement « appinstalled » (installée depuis la barre d'adresse de Chrome) : installée", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.chromeOrdinateur });
    await monter();
    act(() => {
      window.dispatchEvent(demandeInstallation());
    });
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(etat()).toBe("installee");
  });

  it("Safari sur iPhone, Chrome sur iPhone, iPad qui se présente comme un Mac : « ios »", async () => {
    for (const [ua, toucher] of [
      [NAVIGATEURS.safariIphone, 5],
      [NAVIGATEURS.chromeIphone, 5],
      [NAVIGATEURS.safariIpadOuMac, 5],
    ] as const) {
      simulerNavigateur({ ua, toucher });
      await monter();
      expect(etat(), ua).toBe("ios");
      cleanup();
      retablirNavigateur();
    }
  });

  it("un Mac (sans écran tactile), Firefox sans demande : « indisponible »", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.safariIpadOuMac, toucher: 0 });
    await monter();
    expect(etat()).toBe("indisponible");
    cleanup();
    simulerNavigateur({ ua: NAVIGATEURS.firefox });
    await monter();
    expect(etat()).toBe("indisponible");
  });

  it("rendu du serveur : « indisponible », quel que soit l'appareil (pas d'écart à l'hydratation)", async () => {
    simulerNavigateur({ ua: NAVIGATEURS.safariIphone, toucher: 5 });
    const { Etat } = await charger();
    expect(renderToString(<Etat />)).toContain("indisponible");
  });
});

describe("Installer l'application : le service worker", () => {
  it("il est enregistré dès le chargement de l'espace connecté, à la même adresse que pour le push", async () => {
    const register = vi.fn(async () => ({}));
    Object.defineProperty(window.navigator, "serviceWorker", { configurable: true, value: { register } });
    simulerNavigateur();
    await monter();
    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/" });
  });

  it("sans service worker (http, navigation privée) ou s'il est refusé, rien ne casse", async () => {
    simulerNavigateur();
    await monter();
    expect(etat()).toBe("indisponible");
    cleanup();
    Object.defineProperty(window.navigator, "serviceWorker", { configurable: true, value: { register: vi.fn(async () => Promise.reject(new Error("refusé"))) } });
    await monter();
    expect(etat()).toBe("indisponible");
  });
});
