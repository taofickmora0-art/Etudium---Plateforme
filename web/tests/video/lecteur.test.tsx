// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Adaptateur, Evenements } from "@/lib/video/adaptateurs";
import { fusionner } from "@/lib/video/suivi";
import { id } from "../lecon/donnees";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => "/formations" }));

const { LecteurEtudium } = await import("@/components/lecon/LecteurEtudium");

const VIDEO = { fournisseur: "youtube" as const, id: "dQw4w9WgXcQ" };

/** Un faux lecteur officiel : position et durée réglables, événements déclenchés par le test. */
function fauxLecteur({ sousTitres = false } = {}) {
  let evenements: Evenements | null = null;
  const etat = { position: 0 };
  const adaptateur: Adaptateur = {
    lire: vi.fn(() => evenements?.etat(true)),
    pause: vi.fn(() => evenements?.etat(false)),
    aller: vi.fn((s: number) => {
      etat.position = s;
    }),
    position: vi.fn(async () => etat.position),
    duree: vi.fn(async () => 370),
    setMuet: vi.fn(),
    setVitesse: vi.fn(),
    sousTitres: vi.fn(async () => sousTitres),
    setSousTitres: vi.fn(),
    detruire: vi.fn(),
  };
  const creer = vi.fn(async (_video: unknown, _conteneur: HTMLElement, ev: Evenements) => {
    evenements = ev;
    queueMicrotask(() => ev.pret());
    return adaptateur;
  });
  return { adaptateur, creer, etat, evenements: () => evenements! };
}

const reponses: { action: string; corps: Record<string, unknown>; init: RequestInit }[] = [];
let resultat = { secondesVues: 10, reference: 370, terminee: false };

/** Laisse passer `secondes`, une seconde à la fois, en avançant la vidéo de `pas` secondes à chaque fois. */
async function lirePendant(etat: { position: number }, secondes: number, pas = 1) {
  for (let i = 0; i < secondes; i++) {
    etat.position += pas;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
  }
}

const monter = async (props: Partial<Parameters<typeof LecteurEtudium>[0]> & { creer: never | unknown }) => {
  render(
    <ToastProvider>
      <LecteurEtudium
        video={VIDEO}
        titre="Découvrir l’interface"
        legende="Module 1 · Découvrir l’interface"
        leconId={id(1)}
        suivre
        passagesInitiaux={[]}
        reference={370}
        seuil={90}
        termineeInitiale={false}
        {...(props as object)}
      />
    </ToastProvider>,
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

describe("Lecteur aux couleurs d'Étudium", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearInterval", "clearTimeout", "Date"] });
    reponses.length = 0;
    resultat = { secondesVues: 10, reference: 370, terminee: false };
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const corps = JSON.parse(String(init.body));
        reponses.push({ action: corps.action, corps, init });
        return new Response(JSON.stringify(corps.action === "commencer" ? {} : resultat), { status: 200, headers: { "content-type": "application/json" } });
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("les commandes pilotent le lecteur officiel : lecture, pause, piste, vitesse et son", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    expect(screen.getByText("00:00 / 06:10")).toBeInTheDocument();
    expect(screen.getByText("Module 1 · Découvrir l’interface")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    expect(f.adaptateur.lire).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    expect(f.adaptateur.pause).toHaveBeenCalled();
    fireEvent.change(screen.getByRole("slider", { name: "Avancer dans la vidéo" }), { target: { value: "120" } });
    expect(f.adaptateur.aller).toHaveBeenCalledWith(120);
    fireEvent.click(screen.getByRole("button", { name: "Vitesse de lecture : 1×" }));
    expect(f.adaptateur.setVitesse).toHaveBeenCalledWith(1.25);
    expect(screen.getByRole("button", { name: "Vitesse de lecture : 1,25×" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Couper le son" }));
    expect(f.adaptateur.setMuet).toHaveBeenCalledWith(true);
    expect(screen.getByRole("button", { name: "Remettre le son" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sous-titres" })).toBeNull();
  });

  it("les sous-titres s'activent quand la vidéo en a", async () => {
    const f = fauxLecteur({ sousTitres: true });
    await monter({ creer: f.creer });
    const bouton = screen.getByRole("button", { name: "Sous-titres" });
    expect(bouton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bouton);
    expect(f.adaptateur.setSousTitres).toHaveBeenCalledWith(true);
    expect(bouton).toHaveAttribute("aria-pressed", "true");
  });

  it("la lecture continue est envoyée toutes les 10 s ; un saut dans la barre ne l'est pas", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(reponses[0]).toMatchObject({ action: "commencer", corps: { lecon: id(1) } });
    await lirePendant(f.etat, 10);
    // Un premier envoi part au bout de 10 s (la dernière seconde peut partir avec le suivant).
    expect(reponses.find((r) => r.action === "enregistrer")?.corps).toMatchObject({ lecon: id(1), duree: 370 });
    // Saut jusqu'à la fin, puis pause : le saut (de 10 à 361) n'est pas compté, la lecture qui suit l'est.
    f.etat.position = 360;
    await lirePendant(f.etat, 3);
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const envoyes = reponses.filter((r) => r.action === "enregistrer").flatMap((r) => r.corps.passages as [number, number][]);
    expect(fusionner(envoyes)).toEqual([
      [0, 10],
      [361, 363],
    ]);
  });

  it("en quittant la page, le dernier passage part quand même (keepalive)", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await lirePendant(f.etat, 4);
    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
      await vi.advanceTimersByTimeAsync(0);
    });
    const dernier = reponses.filter((r) => r.action === "enregistrer").at(-1);
    expect(dernier?.corps.passages).toEqual([[0, 4]]);
    expect(dernier?.init.keepalive).toBe(true);
  });

  it("le temps regardé s'affiche, puis « Leçon validée » au seuil, avec un toast", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer, passagesInitiaux: [[0, 40]] });
    expect(screen.getByText("Temps réellement regardé : 11 %")).toBeInTheDocument();
    expect(screen.getByText("Seuil de validation fixé par la formatrice : 90 %")).toBeInTheDocument();
    expect(screen.getByText("Avancer dans la barre ne compte pas")).toBeInTheDocument();
    resultat = { secondesVues: 340, reference: 370, terminee: true };
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    f.etat.position = 40;
    await lirePendant(f.etat, 10);
    expect(screen.getByText("Leçon validée")).toBeInTheDocument();
    expect(screen.getByText("Leçon terminée.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("une leçon déjà validée l'annonce dès l'ouverture", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer, termineeInitiale: true });
    expect(screen.getByText("Leçon validée")).toBeInTheDocument();
  });

  it("un visiteur regarde sans que rien ne soit envoyé ni affiché", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer, suivre: false });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await lirePendant(f.etat, 12);
    expect(reponses).toEqual([]);
    expect(screen.queryByText(/Temps réellement regardé/)).toBeNull();
  });

  it("si le lecteur officiel ne se charge pas (réseau, bloqueur), la vidéo reste lisible", async () => {
    const creer = vi.fn(async () => {
      throw new Error("script bloqué");
    });
    await monter({ creer });
    expect(screen.getByTitle("Vidéo : Découvrir l’interface")).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  });
});
