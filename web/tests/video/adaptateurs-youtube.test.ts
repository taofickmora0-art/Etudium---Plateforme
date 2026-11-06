// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerAdaptateur, type Evenements } from "@/lib/video/adaptateurs";

// Les sous-titres de YouTube (ta demande du 6 novembre 2026) : masqués au départ pour toutes les vidéos, même quand
// YouTube les rallume au lancement de la lecture (sous-titres automatiques, langue du navigateur) ; le bouton
// « Sous-titres » d'Étudium les remet, et ils restent alors affichés.

type Options = { videoId: string; playerVars: Record<string, unknown>; events: { onReady(): void; onStateChange(e: { data: number }): void; onApiChange(): void } };

let options: Options | undefined;
const lecteur = {
  loadModule: vi.fn(),
  unloadModule: vi.fn(),
  getOption: vi.fn((): unknown => [{ languageCode: "fr" }]),
  getOptions: vi.fn((): string[] => ["captions"]),
  playVideo: vi.fn(),
  pauseVideo: vi.fn(),
  destroy: vi.fn(),
};

beforeEach(() => {
  options = undefined;
  vi.stubGlobal("YT", {
    Player: vi.fn(function (_cible: HTMLElement, o: Options) {
      options = o;
      return lecteur;
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("Les sous-titres de YouTube", () => {
  it("masqués au lancement de la lecture ; le bouton les remet, et YouTube ne les retire plus", async () => {
    const ev: Evenements = { pret: vi.fn(), etat: vi.fn(), fin: vi.fn() };
    const promesse = creerAdaptateur({ fournisseur: "youtube", id: "UMEfqO80sb0" }, document.body.appendChild(document.createElement("div")), ev);
    await vi.waitFor(() => expect(options).toBeDefined());
    options!.events.onReady();
    const a = await promesse;

    lecteur.unloadModule.mockClear();
    options!.events.onStateChange({ data: 1 });
    expect(lecteur.unloadModule).toHaveBeenCalledWith("captions");

    a.setSousTitres(true);
    expect(lecteur.loadModule).toHaveBeenLastCalledWith("captions");
    lecteur.unloadModule.mockClear();
    options!.events.onStateChange({ data: 1 });
    expect(lecteur.unloadModule).not.toHaveBeenCalled();

    a.setSousTitres(false);
    lecteur.unloadModule.mockClear();
    options!.events.onStateChange({ data: 1 });
    expect(lecteur.unloadModule).toHaveBeenCalledWith("captions");
  });

  it("des sous-titres livrés en cours de lecture (automatiques) : le bouton est prévenu, et ils restent masqués", async () => {
    const ev: Evenements = { pret: vi.fn(), etat: vi.fn(), fin: vi.fn(), sousTitres: vi.fn() };
    // À l'ouverture, aucune piste : le bouton ne s'affiche pas encore.
    lecteur.getOption.mockReturnValue([]);
    const promesse = creerAdaptateur({ fournisseur: "youtube", id: "UMEfqO80sb0" }, document.body.appendChild(document.createElement("div")), ev);
    await vi.waitFor(() => expect(options).toBeDefined());
    options!.events.onReady();
    await promesse;
    expect(ev.sousTitres).not.toHaveBeenCalled();

    // La lecture lancée, YouTube charge ses sous-titres (onApiChange) : on prévient, puis on les masque.
    lecteur.getOption.mockReturnValue([{ languageCode: "fr", kind: "asr" }]);
    lecteur.unloadModule.mockClear();
    options!.events.onApiChange();
    expect(ev.sousTitres).toHaveBeenCalled();
    expect(lecteur.unloadModule).toHaveBeenCalledWith("captions");
  });
});
