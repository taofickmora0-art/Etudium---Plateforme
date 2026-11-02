// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IndicateurSauvegarde } from "@/components/editeur/IndicateurSauvegarde";
import { useSauvegardeAuto, type EtatSauvegarde } from "@/components/editeur/useSauvegardeAuto";
import { ecrireCopie, lireCopie } from "@/lib/editeur/copie-locale";
import type { ResultatSauvegarde } from "@/lib/editeur/types";

// La sauvegarde automatique (fin du lot 4, spec §2.1) : 1,5 s après la dernière modification, une sauvegarde à la fois,
// des nouveaux essais (2, 5, 15 s), hors ligne puis reprise, la copie de l'appareil et sa récupération, le conflit.

type V = { titre: string };
const OK = (revision: number, brouillon = true): ResultatSauvegarde => ({ ok: true, revision, brouillon, enregistreLe: "2026-11-01T14:32:00Z" });
const differe = <R,>() => {
  let resoudre!: (r: R) => void;
  const promesse = new Promise<R>((r) => (resoudre = r));
  return { promesse, resoudre };
};
const enLigne = (valeur: boolean) => Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => valeur });

function monter(enregistrer: (v: V, r: number) => Promise<ResultatSauvegarde>, initiale: V = { titre: "A" }, revision = 3) {
  return renderHook(({ valeur }) => useSauvegardeAuto({ cle: "lecon:l1", valeur, revisionInitiale: revision, brouillonInitial: false, enregistrer }), {
    initialProps: { valeur: initiale },
  });
}
const avancer = async (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  enLigne(true);
});
afterEach(() => vi.useRealTimers());

describe("La sauvegarde automatique", () => {
  it("rien ne part à l'ouverture (Review Focus 5)", async () => {
    const enregistrer = vi.fn(async () => OK(4));
    const { result } = monter(enregistrer);
    await avancer(5000);
    expect(enregistrer).not.toHaveBeenCalled();
    expect(result.current.etat).toEqual({ type: "a_jour", le: null, brouillon: false });
  });

  it("1,5 s après la dernière frappe, une seule sauvegarde, avec la révision vue ; la copie de l'appareil s'efface", async () => {
    const enregistrer = vi.fn(async () => OK(4));
    const { result, rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    expect(result.current.etat).toEqual({ type: "modifie" });
    expect(lireCopie<V>("lecon:l1")).toMatchObject({ valeur: { titre: "AB" }, revision: 3 });
    await avancer(1000);
    rerender({ valeur: { titre: "ABC" } });
    await avancer(1000);
    expect(enregistrer).not.toHaveBeenCalled();
    await avancer(600);
    expect(enregistrer).toHaveBeenCalledTimes(1);
    expect(enregistrer).toHaveBeenCalledWith({ titre: "ABC" }, 3);
    expect(result.current.etat).toEqual({ type: "a_jour", le: "2026-11-01T14:32:00Z", brouillon: true });
    expect(lireCopie("lecon:l1")).toBeNull();
  });

  it("Review Focus 2 : un changement pendant l'envoi part après, avec la révision rendue par le premier", async () => {
    const premier = differe<ResultatSauvegarde>();
    const enregistrer = vi.fn().mockReturnValueOnce(premier.promesse).mockResolvedValueOnce(OK(5));
    const { result, rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    await avancer(1500);
    expect(result.current.etat).toEqual({ type: "en_cours" });
    rerender({ valeur: { titre: "ABC" } });
    await avancer(1500);
    expect(enregistrer).toHaveBeenCalledTimes(1);
    await act(async () => premier.resoudre(OK(4)));
    await avancer(0);
    expect(enregistrer).toHaveBeenCalledTimes(2);
    expect(enregistrer).toHaveBeenLastCalledWith({ titre: "ABC" }, 4);
    expect(result.current.etat).toMatchObject({ type: "a_jour" });
  });

  it("échec : nouvel essai à 2 s ; hors ligne : en attente, puis reprise au retour du réseau", async () => {
    const enregistrer = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "echec", message: "Panne" })
      .mockResolvedValueOnce(OK(4))
      .mockResolvedValueOnce(OK(5));
    const { result, rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    await avancer(1500);
    expect(result.current.etat).toEqual({ type: "echec", message: "Panne" });
    await avancer(2000);
    expect(enregistrer).toHaveBeenCalledTimes(2);
    expect(result.current.etat).toMatchObject({ type: "a_jour" });

    enLigne(false);
    rerender({ valeur: { titre: "ABC" } });
    await avancer(1500);
    expect(result.current.etat).toEqual({ type: "hors_ligne" });
    expect(enregistrer).toHaveBeenCalledTimes(2);
    expect(lireCopie<V>("lecon:l1")?.valeur).toEqual({ titre: "ABC" });
    enLigne(true);
    await act(async () => void window.dispatchEvent(new Event("online")));
    await avancer(0);
    expect(enregistrer).toHaveBeenCalledTimes(3);
    expect(enregistrer).toHaveBeenLastCalledWith({ titre: "ABC" }, 4);
  });

  it("conflit : plus aucun envoi", async () => {
    const enregistrer = vi.fn(async (): Promise<ResultatSauvegarde> => ({ ok: false, code: "conflit", par: "Aïcha Kpadé" }));
    const { result, rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    await avancer(1500);
    expect(result.current.etat).toEqual({ type: "conflit", par: "Aïcha Kpadé" });
    rerender({ valeur: { titre: "ABC" } });
    await avancer(20_000);
    expect(enregistrer).toHaveBeenCalledTimes(1);
  });

  it("Review Focus 4 : invalide → le message, pas de nouvel essai, la copie de l'appareil reste ; une correction repart", async () => {
    const enregistrer = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "invalide", erreurs: { texte: "Le texte dépasse 20 000 caractères." } })
      .mockResolvedValueOnce(OK(4));
    const { result, rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "trop long" } });
    await avancer(1500);
    expect(result.current.etat).toEqual({ type: "invalide", erreurs: { texte: "Le texte dépasse 20 000 caractères." } });
    await avancer(20_000);
    expect(enregistrer).toHaveBeenCalledTimes(1);
    expect(lireCopie<V>("lecon:l1")?.valeur).toEqual({ titre: "trop long" });
    rerender({ valeur: { titre: "court" } });
    await avancer(1500);
    expect(enregistrer).toHaveBeenCalledTimes(2);
  });

  it("une copie de l'appareil plus récente (même révision) se propose ; Ignorer l'efface ; une copie d'une autre révision est oubliée", async () => {
    ecrireCopie("lecon:l1", { titre: "Non enregistré" }, 3);
    const { result } = monter(vi.fn());
    expect(result.current.recuperation).toMatchObject({ valeur: { titre: "Non enregistré" } });
    let valeur: V | null = null;
    act(() => void (valeur = result.current.recuperer()));
    expect(valeur).toEqual({ titre: "Non enregistré" });
    expect(result.current.recuperation).toBeNull();

    ecrireCopie("lecon:l1", { titre: "Autre" }, 3);
    const deux = monter(vi.fn());
    act(() => deux.result.current.ignorer());
    expect(deux.result.current.recuperation).toBeNull();
    expect(lireCopie("lecon:l1")).toBeNull();

    // Relecture (3) : après un conflit, la copie porte une révision plus ancienne ; elle se propose, signalée.
    ecrireCopie("lecon:l1", { titre: "Ancienne" }, 1);
    expect(monter(vi.fn()).result.current.recuperation).toMatchObject({ valeur: { titre: "Ancienne" }, ancienne: true });
  });

  it("relecture (6) : après les trois nouveaux essais, l'éditeur réessaie encore toutes les 30 s", async () => {
    const enregistrer = vi.fn(async (): Promise<ResultatSauvegarde> => ({ ok: false, code: "echec", message: "Panne" }));
    const { rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    await avancer(1500 + 2000 + 5000 + 15000);
    expect(enregistrer).toHaveBeenCalledTimes(4);
    await avancer(30_000);
    expect(enregistrer).toHaveBeenCalledTimes(5);
    await avancer(30_000);
    expect(enregistrer).toHaveBeenCalledTimes(6);
  });

  it("point reporté du lot 4 : un envoi qui ne répond jamais compte comme un échec après 30 s ; les suivants repartent", async () => {
    const jamais = differe<ResultatSauvegarde>();
    const enregistrer = vi
      .fn<(v: V, r: number) => Promise<ResultatSauvegarde>>()
      .mockReturnValueOnce(jamais.promesse)
      .mockResolvedValue({ ok: true, revision: 4, brouillon: false, enregistreLe: "2026-11-02T10:00:00" });
    const { result, rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    await avancer(1500);
    expect(enregistrer).toHaveBeenCalledTimes(1);
    rerender({ valeur: { titre: "ABC" } });
    await avancer(30_000);
    expect(result.current.etat.type).toBe("echec");
    await avancer(2000);
    expect(enregistrer).toHaveBeenCalledTimes(2);
    expect(enregistrer.mock.calls[1][0]).toEqual({ titre: "ABC" });
  });

  it("relecture (3) : en conflit ou en refus, quitter la page est retenu (rien n'est enregistré)", async () => {
    const enregistrer = vi.fn(async (): Promise<ResultatSauvegarde> => ({ ok: false, code: "conflit", par: null }));
    const { rerender } = monter(enregistrer);
    rerender({ valeur: { titre: "AB" } });
    await avancer(1500);
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });

  it("quitter la page : retenu seulement s'il reste quelque chose à enregistrer", async () => {
    const enregistrer = vi.fn(async () => OK(4));
    const { rerender } = monter(enregistrer);
    const quitter = () => {
      const e = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(quitter()).toBe(false);
    rerender({ valeur: { titre: "AB" } });
    expect(quitter()).toBe(true);
    await avancer(1500);
    expect(quitter()).toBe(false);
  });
});

describe("L'indicateur", () => {
  const voir = (etat: EtatSauvegarde) => {
    const { unmount } = render(<IndicateurSauvegarde etat={etat} />);
    const texte = screen.getByRole("status").textContent;
    unmount();
    return texte;
  };
  it("chaque libellé", () => {
    vi.useRealTimers();
    expect(voir({ type: "modifie" })).toBe("Modifications non enregistrées");
    expect(voir({ type: "en_cours" })).toBe("Enregistrement…");
    expect(voir({ type: "a_jour", le: null, brouillon: false })).toBe("Enregistré");
    expect(voir({ type: "a_jour", le: null, brouillon: true })).toBe("Brouillon enregistré");
    expect(voir({ type: "a_jour", le: "2026-11-01T14:32:00", brouillon: true })).toBe("Brouillon enregistré à 14 h 32");
    expect(voir({ type: "a_jour", le: "2026-11-01T09:05:00", brouillon: false })).toBe("Enregistré à 9 h 05");
    expect(voir({ type: "hors_ligne" })).toBe("Hors ligne : vos modifications sont gardées sur cet appareil");
    expect(voir({ type: "echec", message: "x" })).toBe("Échec de l’enregistrement. Nouvel essai…");
    // Relecture : une migration absente se dit telle quelle (sinon « Nouvel essai… » sans fin, sans explication).
    expect(voir({ type: "echec", message: "L’enregistrement automatique n’est pas encore installé (migration 0056, guide « Ce qui te revient », section 58)." })).toBe(
      "L’enregistrement automatique n’est pas encore installé (migration 0056, guide « Ce qui te revient », section 58).",
    );
    expect(voir({ type: "conflit", par: null })).toBe("Non enregistré");
    expect(voir({ type: "invalide", erreurs: {} })).toBe("Non enregistré : à corriger");
  });

  it("la copie de l'appareil : un stockage qui refuse ne lève rien", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("plein");
    });
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    expect(() => ecrireCopie("x", { a: 1 }, 1)).not.toThrow();
    expect(lireCopie("x")).toBeNull();
    setItem.mockRestore();
    getItem.mockRestore();
  });
});
