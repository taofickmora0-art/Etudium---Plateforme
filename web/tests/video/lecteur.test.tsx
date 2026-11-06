// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import type { Adaptateur, Evenements } from "@/lib/video/adaptateurs";
import { masquerVideo } from "@/lib/video/masque";
import { fusionner } from "@/lib/video/suivi";
import { id } from "../lecon/donnees";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }), usePathname: () => "/formations" }));

const { LecteurEtudium } = await import("@/components/lecon/LecteurEtudium");
const { EtatLeconProvider, useEtatLecon } = await import("@/components/lecon/EtatLecon");

function SondeEtat() {
  const etat = useEtatLecon();
  return <span>{etat?.terminee ? "état : terminée" : "état : à faire"}</span>;
}

// Le lecteur reçoit l'identifiant brouillé (il n'est pas en clair dans le code de la page) et le retrouve lui-même.
const VIDEO = masquerVideo({ fournisseur: "youtube", id: "dQw4w9WgXcQ" });

/** Un faux lecteur officiel : position et durée réglables, événements déclenchés par le test. */
function fauxLecteur({ sousTitres = false, durees = [370] }: { sousTitres?: boolean; durees?: number[] } = {}) {
  let evenements: Evenements | null = null;
  const etat = { position: 0 };
  const adaptateur: Adaptateur = {
    lire: vi.fn(() => evenements?.etat(true)),
    pause: vi.fn(() => evenements?.etat(false)),
    aller: vi.fn((s: number) => {
      etat.position = s;
    }),
    position: vi.fn(async () => etat.position),
    // Comme YouTube : la durée peut valoir 0 tant que la lecture n'a pas commencé.
    duree: vi.fn(async () => (durees.length > 1 ? durees.shift()! : durees[0])),
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
let resultat: Record<string, unknown> = { secondesVues: 10, reference: 370, terminee: false };
/** Réponses imposées, prises dans l'ordre, par action : un statut HTTP, ou « réseau » pour une coupure. */
let imposees: Record<string, (number | "réseau")[]> = {};

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

describe("Le lien de la vidéo, caché au mieux", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearInterval", "clearTimeout", "Date"] });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 200, headers: { "content-type": "application/json" } })));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("l'identifiant n'est pas en clair dans ce que reçoit la page ; le lecteur le retrouve ; pas de menu du clic droit", async () => {
    expect(JSON.stringify(VIDEO)).not.toContain("dQw4w9WgXcQ");
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    expect(f.creer).toHaveBeenCalledWith({ fournisseur: "youtube", id: "dQw4w9WgXcQ" }, expect.anything(), expect.anything());
    expect(fireEvent.contextMenu(document.querySelector("[data-surface]")!)).toBe(false);
  });
});

describe("Lecteur aux couleurs d'Étudium", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "clearInterval", "clearTimeout", "Date"] });
    reponses.length = 0;
    resultat = { secondesVues: 10, reference: 370, terminee: false };
    imposees = {};
    refresh.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const corps = JSON.parse(String(init.body));
        reponses.push({ action: corps.action, corps, init });
        const impose = imposees[corps.action]?.shift();
        if (impose === "réseau") throw new TypeError("Failed to fetch");
        if (impose) return new Response(JSON.stringify({}), { status: impose, headers: { "content-type": "application/json" } });
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

  it("des sous-titres que YouTube ne livre qu'une fois la lecture lancée (automatiques) : le bouton apparaît alors", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    expect(screen.queryByRole("button", { name: "Sous-titres" })).toBeNull();
    act(() => f.evenements().sousTitres?.());
    fireEvent.click(screen.getByRole("button", { name: "Sous-titres" }));
    expect(f.adaptateur.setSousTitres).toHaveBeenCalledWith(true);
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
    expect(reponses.find((r) => r.action === "enregistrer")?.corps).toMatchObject({ lecon: id(1) });
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

  it("une durée indiquée plus longue que la vidéo : le seuil ne peut pas être atteint, et le lecteur le dit", async () => {
    const f = fauxLecteur({ durees: [462] });
    await monter({ creer: f.creer, reference: 600 });
    expect(screen.getByText("La vidéo dure 07:42, mais la leçon indique 10:00 : le seuil de 90 % ne peut pas être atteint. Prévenez le formateur.")).toBeInTheDocument();
  });

  it("une leçon vidéo sans durée indiquée ne peut pas être validée, et le lecteur le dit", async () => {
    const f = fauxLecteur({ durees: [462] });
    await monter({ creer: f.creer, reference: 0 });
    expect(screen.getByText("La durée de cette vidéo n’est pas indiquée dans la leçon : elle ne peut pas encore être validée. Prévenez le formateur.")).toBeInTheDocument();
  });

  it("une durée indiquée juste : pas de message", async () => {
    const f = fauxLecteur({ durees: [370] });
    await monter({ creer: f.creer, reference: 370 });
    expect(screen.queryByText(/Prévenez le formateur/)).toBeNull();
  });

  it("TikTok ou Tella : si leur lecteur ne répond pas, « Terminer la leçon » se débloque (jamais d'impasse, revue)", async () => {
    const creer = vi.fn(async () => {
      throw new Error("lecteur muet");
    });
    const { BoutonFin } = await import("@/components/lecon/BoutonFin");
    render(
      <ToastProvider>
        <EtatLeconProvider termineeInitiale={false} avecVideo seuil={90} actif>
          <LecteurEtudium
            video={masquerVideo({ fournisseur: "tiktok", id: "7234567890123456789" })}
            titre="Découvrir l’interface"
            legende="Module 1"
            leconId={id(1)}
            suivre
            passagesInitiaux={[]}
            reference={61}
            seuil={90}
            termineeInitiale={false}
            creer={creer as never}
          />
          <BoutonFin leconId={id(1)} variante="ordinateur" />
        </EtatLeconProvider>
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Le temps regardé ne peut pas être mesuré avec ce lecteur : terminez la leçon avec « Terminer la leçon ».")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Terminer la leçon" })).toBeEnabled();
  });

  it("la dernière seconde compte : à la fin de la vidéo, le passage jusqu'au bout est envoyé (seuil à 100 %, revue)", async () => {
    const f = fauxLecteur({ durees: [61] });
    await monter({ creer: f.creer, reference: 61, seuil: 100 });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    f.etat.position = 59.6;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    f.etat.position = 60.4;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(800);
    });
    await act(async () => {
      f.evenements().etat(false);
      f.evenements().fin();
      await vi.advanceTimersByTimeAsync(0);
    });
    const envoyes = reponses.filter((r) => r.action === "enregistrer").flatMap((r) => r.corps.passages as [number, number][]);
    expect(Math.max(...envoyes.map(([, fin]) => fin))).toBe(61);
  });

  it("pendant la lecture, les commandes s'effacent (2,5 s sans mouvement, ou la souris sort) et reviennent au mouvement ; en pause, elles restent (retour du 15 octobre)", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    const commandes = () => screen.getByRole("button", { name: /Lancer la lecture|Mettre en pause/ }).closest("[data-commandes]")!;
    const cadre = () => commandes().parentElement!;
    expect(commandes()).toHaveAttribute("data-masquees", "false");
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(commandes()).toHaveAttribute("data-masquees", "false");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    expect(commandes()).toHaveAttribute("data-masquees", "true");
    fireEvent.pointerMove(cadre());
    expect(commandes()).toHaveAttribute("data-masquees", "false");
    fireEvent.pointerLeave(cadre());
    expect(commandes()).toHaveAttribute("data-masquees", "true");
    // Le clavier : une commande qui reçoit le focus les fait revenir.
    fireEvent.focus(screen.getByRole("button", { name: "Mettre en pause" }));
    expect(commandes()).toHaveAttribute("data-masquees", "false");
    fireEvent.click(screen.getByRole("button", { name: "Mettre en pause" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(commandes()).toHaveAttribute("data-masquees", "false");
  });

  it("après un clic sur un bouton de la barre (lecture), les commandes s'effacent quand même ; au clavier (Tab), elles restent", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const pause = screen.getByRole("button", { name: "Mettre en pause" });
    const commandes = pause.closest("[data-commandes]")!;
    // À la souris : le bouton cliqué garde le focus, mais ce n'est pas le clavier.
    fireEvent.pointerDown(pause);
    pause.focus();
    fireEvent.pointerMove(commandes.parentElement!);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    expect(commandes).toHaveAttribute("data-masquees", "true");
    // Au clavier : Tab jusqu'au bouton, les commandes restent tant que le focus y est.
    fireEvent.keyDown(document, { key: "Tab" });
    pause.blur();
    pause.focus();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    expect(commandes).toHaveAttribute("data-masquees", "false");
  });

  it("au téléphone, toucher la vidéo quand les commandes sont effacées les fait revenir, sans mettre en pause", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    const commandes = screen.getByRole("button", { name: "Mettre en pause" }).closest("[data-commandes]")!;
    expect(commandes).toHaveAttribute("data-masquees", "true");
    const surface = commandes.parentElement!.querySelector("[data-surface]")!;
    fireEvent.touchStart(surface);
    fireEvent.click(surface);
    expect(f.adaptateur.pause).not.toHaveBeenCalled();
    expect(commandes).toHaveAttribute("data-masquees", "false");
  });

  it("une plateforme à vitesse fixe (TikTok, Tella) : pas de bouton de vitesse", async () => {
    const f = fauxLecteur();
    f.adaptateur.vitesseFixe = true;
    await monter({ creer: f.creer });
    expect(screen.queryByRole("button", { name: /Vitesse de lecture/ })).toBeNull();
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
    // Le temps regardé ne peut plus être mesuré : on le dit, au lieu d'un pourcentage figé.
    expect(screen.queryByText(/Temps réellement regardé/)).toBeNull();
    expect(screen.getByText("Le temps regardé ne peut pas être mesuré avec ce lecteur. Rechargez la page pour réessayer.")).toBeInTheDocument();
  });

  it("une relecture de la page par le serveur (même vidéo, nouvel objet) ne recrée pas le lecteur", async () => {
    const f = fauxLecteur();
    const props = {
      titre: "Découvrir l’interface",
      leconId: id(1),
      suivre: true,
      passagesInitiaux: [] as [number, number][],
      reference: 370,
      seuil: 90,
      termineeInitiale: false,
      creer: f.creer,
    };
    const { rerender } = render(
      <ToastProvider>
        <LecteurEtudium video={{ ...VIDEO }} {...props} />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    rerender(
      <ToastProvider>
        <LecteurEtudium video={{ ...VIDEO }} {...props} />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(f.creer).toHaveBeenCalledTimes(1);
    expect(f.adaptateur.detruire).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Mettre en pause" })).toBeInTheDocument();
  });

  it("une durée inconnue au départ (YouTube) est relue une fois la lecture lancée", async () => {
    const f = fauxLecteur({ durees: [0, 0, 400] });
    await monter({ creer: f.creer, reference: 0 });
    expect(screen.getByText("00:00 / 00:00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await lirePendant(f.etat, 2);
    expect(screen.getByText(/ \/ 06:40$/)).toBeInTheDocument();
  });

  it("si « commencer » échoue (coupure réseau), il est retenté et rien n'est perdu", async () => {
    imposees = { commencer: ["réseau"] };
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await lirePendant(f.etat, 25);
    expect(reponses.filter((r) => r.action === "commencer").length).toBeGreaterThanOrEqual(2);
    const envoyes = reponses.filter((r) => r.action === "enregistrer").flatMap((r) => r.corps.passages as [number, number][]);
    expect(fusionner(envoyes)[0][0]).toBe(0);
  });

  it("après un refus (409), le visionnage repart aussitôt ; seuls les passages refusés sont perdus", async () => {
    imposees = { enregistrer: [409] };
    const f = fauxLecteur();
    await monter({ creer: f.creer });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await lirePendant(f.etat, 10);
    // Refus du premier envoi : « commencer » est rappelé tout de suite, sans attendre une nouvelle lecture.
    expect(reponses.filter((r) => r.action === "commencer")).toHaveLength(2);
    resultat = { secondesVues: 11, reference: 370, terminee: false, passages: [[9, 20]] };
    await lirePendant(f.etat, 10);
    const second = reponses.filter((r) => r.action === "enregistrer")[1];
    expect((second.corps.passages as [number, number][])[0][0]).toBeGreaterThanOrEqual(9);
    // Le pourcentage affiché suit la base : les passages refusés n'y sont pas.
    expect(screen.getByText("Temps réellement regardé : 3 %")).toBeInTheDocument();
  });

  it("la vidéo reprend là où on l'avait laissée, sans démarrer toute seule (au-delà des 5 premières secondes)", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer, positionInitiale: 250 });
    // Position affichée tout de suite, mais aucun saut avant « Lire » : sur YouTube, un saut lance la lecture.
    expect(screen.getByText("04:10 / 06:10")).toBeInTheDocument();
    expect(f.adaptateur.aller).not.toHaveBeenCalled();
    expect(f.adaptateur.lire).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    expect(f.adaptateur.aller).toHaveBeenCalledWith(250);
    expect(f.adaptateur.lire).toHaveBeenCalled();
    expect(vi.mocked(f.adaptateur.aller).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(f.adaptateur.lire).mock.invocationCallOrder[0]);
  });

  it("au retour sur une page gardée en mémoire, la vidéo reprend où elle en était (pas à la position du premier affichage)", async () => {
    const f = fauxLecteur();
    const props = {
      video: VIDEO,
      titre: "Découvrir l’interface",
      leconId: id(1),
      suivre: true,
      passagesInitiaux: [] as [number, number][],
      reference: 370,
      seuil: 90,
      termineeInitiale: false,
      positionInitiale: 0,
    };
    const { rerender } = render(
      <ToastProvider>
        <LecteurEtudium {...props} creer={f.creer} />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await lirePendant(f.etat, 240);
    // Next masque puis réaffiche la page (navigation dans l'application) : le lecteur est recréé.
    const g = fauxLecteur();
    rerender(
      <ToastProvider>
        <LecteurEtudium {...props} creer={g.creer} />
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("04:00 / 06:10")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    expect(g.adaptateur.aller).toHaveBeenCalledWith(240);
  });

  it("une position de quelques secondes, ou presque à la fin, repart du début", async () => {
    const f = fauxLecteur();
    await monter({ creer: f.creer, positionInitiale: 3 });
    const g = fauxLecteur();
    await monter({ creer: g.creer, positionInitiale: 365 });
    expect(f.adaptateur.aller).not.toHaveBeenCalled();
    expect(g.adaptateur.aller).not.toHaveBeenCalled();
  });

  it("la validation par la base est annoncée au bouton de fin (état partagé)", async () => {
    resultat = { secondesVues: 340, reference: 370, terminee: true };
    const f = fauxLecteur();
    render(
      <ToastProvider>
        <EtatLeconProvider termineeInitiale={false} avecVideo seuil={90} actif>
          <LecteurEtudium
            video={VIDEO}
            titre="Découvrir l’interface"
            leconId={id(1)}
            suivre
            passagesInitiaux={[]}
            reference={370}
            seuil={90}
            termineeInitiale={false}
            creer={f.creer}
          />
          <SondeEtat />
        </EtatLeconProvider>
      </ToastProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("état : à faire")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lire la vidéo" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await lirePendant(f.etat, 10);
    expect(screen.getByText("état : terminée")).toBeInTheDocument();
  });
});

