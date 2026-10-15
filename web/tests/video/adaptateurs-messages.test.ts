// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { creerAdaptateur, type Evenements } from "@/lib/video/adaptateurs";

// Les lecteurs TikTok et Tella, pilotés par messages (spec 2026-10-15-plateformes-video-design, §1) : prêt, état,
// position et durée, fin, commandes ; un message d'une autre origine (ou d'une autre fenêtre) est ignoré.

const evenements = (): Evenements & { [k: string]: ReturnType<typeof vi.fn> } => ({ pret: vi.fn(), etat: vi.fn(), fin: vi.fn() });
const conteneur = () => document.body.appendChild(document.createElement("div"));
const iframe = (c: HTMLElement) => c.querySelector("iframe")!;
const recevoir = (origine: string, source: Window | null, data: unknown) => window.dispatchEvent(new MessageEvent("message", { origin: origine, source, data }));
const attendre = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Le lecteur TikTok", () => {
  const TIKTOK = "https://www.tiktok.com";
  const msg = (type: string, value?: unknown) => ({ "x-tiktok-player": true, type, value });

  it("sans commandes TikTok ; prêt, lecture, position et durée, fin ; les commandes partent vers TikTok seulement", async () => {
    const c = conteneur();
    const ev = evenements();
    const promesse = creerAdaptateur({ fournisseur: "tiktok", id: "7234567890123456789" }, c, ev);
    const cadre = iframe(c);
    expect(cadre.src).toBe(
      "https://www.tiktok.com/player/v1/7234567890123456789?controls=0&progress_bar=0&play_button=0&volume_control=0&fullscreen_button=0&timestamp=0&rel=0&music_info=0&description=0&native_context_menu=0&closed_caption=0",
    );
    const envoi = vi.spyOn(cadre.contentWindow!, "postMessage");
    recevoir(TIKTOK, cadre.contentWindow, msg("onPlayerReady"));
    const a = await promesse;
    expect(ev.pret).toHaveBeenCalled();

    recevoir(TIKTOK, cadre.contentWindow, msg("onStateChange", 1));
    expect(ev.etat).toHaveBeenLastCalledWith(true);
    recevoir(TIKTOK, cadre.contentWindow, msg("onCurrentTime", { currentTime: 12.5, duration: 61.2 }));
    expect(await a.position()).toBe(12.5);
    expect(await a.duree()).toBe(61.2);
    recevoir(TIKTOK, cadre.contentWindow, msg("onStateChange", 2));
    expect(ev.etat).toHaveBeenLastCalledWith(false);
    recevoir(TIKTOK, cadre.contentWindow, msg("onStateChange", 0));
    expect(ev.fin).toHaveBeenCalled();

    a.lire();
    a.aller(30);
    a.setMuet(true);
    expect(envoi.mock.calls).toEqual([
      [msg("play"), TIKTOK],
      [msg("seekTo", 30), TIKTOK],
      [msg("mute"), TIKTOK],
    ]);
    expect(await a.position()).toBe(30);
    a.detruire();
    expect(c.querySelector("iframe")).toBeNull();
  });

  it("un message d'une autre origine, d'une autre fenêtre, ou sans le drapeau TikTok est ignoré ; un message en texte JSON est lu", async () => {
    const c = conteneur();
    const ev = evenements();
    const promesse = creerAdaptateur({ fournisseur: "tiktok", id: "7234567890123456789" }, c, ev);
    const cadre = iframe(c);
    recevoir("https://tiktok.com.evil.com", cadre.contentWindow, msg("onPlayerReady"));
    recevoir(TIKTOK, window, msg("onPlayerReady"));
    recevoir(TIKTOK, cadre.contentWindow, { type: "onPlayerReady" });
    await attendre();
    expect(ev.pret).not.toHaveBeenCalled();
    recevoir(TIKTOK, cadre.contentWindow, JSON.stringify(msg("onPlayerReady")));
    await promesse;
    expect(ev.pret).toHaveBeenCalledTimes(1);
  });
});

describe("Le lecteur Tella", () => {
  const TELLA = "https://www.tella.tv";

  it("prêt, état et temps, fin (arrêt au bout) ; les commandes partent vers Tella seulement", async () => {
    const c = conteneur();
    const ev = evenements();
    const promesse = creerAdaptateur({ fournisseur: "tella", id: "mon-cours-excel-a1b2" }, c, ev);
    const cadre = iframe(c);
    expect(cadre.src).toBe("https://www.tella.tv/video/mon-cours-excel-a1b2/embed");
    const envoi = vi.spyOn(cadre.contentWindow!, "postMessage");
    recevoir(TELLA, cadre.contentWindow, { type: "ready" });
    const a = await promesse;
    expect(ev.pret).toHaveBeenCalled();

    recevoir(TELLA, cadre.contentWindow, { type: "playbackState", state: "playing", currentTime: 1, duration: 120 });
    expect(ev.etat).toHaveBeenLastCalledWith(true);
    recevoir(TELLA, cadre.contentWindow, { type: "timeUpdate", currentTime: 16.25, duration: 120 });
    expect(await a.position()).toBe(16.25);
    expect(await a.duree()).toBe(120);
    recevoir(TELLA, cadre.contentWindow, { type: "playbackState", state: "paused", currentTime: 16.25, duration: 120 });
    expect(ev.etat).toHaveBeenLastCalledWith(false);
    expect(ev.fin).not.toHaveBeenCalled();
    recevoir(TELLA, cadre.contentWindow, { type: "playbackState", state: "stopped", currentTime: 120, duration: 120 });
    expect(ev.fin).toHaveBeenCalled();

    a.lire();
    a.pause();
    a.aller(30);
    a.setMuet(false);
    expect(envoi.mock.calls).toEqual([
      [{ type: "play" }, TELLA],
      [{ type: "pause" }, TELLA],
      [{ type: "seek", time: 30 }, TELLA],
      [{ type: "unmute" }, TELLA],
    ]);
  });

  it("un message d'une autre origine est ignoré", async () => {
    const c = conteneur();
    const ev = evenements();
    void creerAdaptateur({ fournisseur: "tella", id: "mon-cours-excel-a1b2" }, c, ev);
    recevoir("https://evil.example", iframe(c).contentWindow, { type: "ready" });
    await attendre();
    expect(ev.pret).not.toHaveBeenCalled();
  });
});

describe("Une plateforme sans mesure", () => {
  it("n'a pas de lecteur piloté : la création échoue (la page montre le lecteur officiel)", async () => {
    await expect(creerAdaptateur({ fournisseur: "drive", id: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345" }, conteneur(), evenements())).rejects.toThrow();
  });
});
