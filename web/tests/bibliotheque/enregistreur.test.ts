import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { creerEnregistreur } from "@/lib/bibliotheque/enregistreur";

// L'enregistrement de la page lue (noter_lecture, 60 appels par minute au plus) : regroupé, au plus une fois toutes les
// 3 secondes, la dernière page l'emportant ; vidé à la fermeture du lecteur.

describe("L'enregistrement regroupé de la page lue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("la première page part tout de suite ; les suivantes, au plus une fois toutes les 3 secondes, la dernière l'emportant", async () => {
    const envoyer = vi.fn();
    const e = creerEnregistreur(envoyer);
    e.noter(12);
    await vi.advanceTimersByTimeAsync(0);
    expect(envoyer.mock.calls).toEqual([[12]]);
    e.noter(13);
    e.noter(14);
    e.noter(15);
    await vi.advanceTimersByTimeAsync(2900);
    expect(envoyer).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(envoyer.mock.calls).toEqual([[12], [15]]);
    // Rien de nouveau : aucun appel.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it("revenir à la page déjà notée avant l'envoi : rien n'est envoyé", async () => {
    const envoyer = vi.fn();
    const e = creerEnregistreur(envoyer);
    e.noter(3);
    await vi.advanceTimersByTimeAsync(0);
    e.noter(4);
    e.noter(3);
    await vi.advanceTimersByTimeAsync(5000);
    expect(envoyer.mock.calls).toEqual([[3]]);
  });

  it("après un long moment sans changement, une nouvelle page part tout de suite", async () => {
    const envoyer = vi.fn();
    const e = creerEnregistreur(envoyer);
    e.noter(1);
    await vi.advanceTimersByTimeAsync(10_000);
    e.noter(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(envoyer.mock.calls).toEqual([[1], [2]]);
  });

  it("vider envoie tout de suite la page en attente (fermeture du lecteur, onglet caché), une seule fois", async () => {
    const envoyer = vi.fn();
    const e = creerEnregistreur(envoyer);
    e.noter(7);
    await vi.advanceTimersByTimeAsync(0);
    e.noter(9);
    e.vider();
    expect(envoyer.mock.calls).toEqual([[7], [9]]);
    await vi.advanceTimersByTimeAsync(5000);
    e.vider();
    expect(envoyer).toHaveBeenCalledTimes(2);
  });

  it("une minute de lecture rapide reste sous la limite de la base (60 par minute)", async () => {
    const envoyer = vi.fn();
    const e = creerEnregistreur(envoyer);
    for (let page = 1; page <= 600; page++) {
      e.noter(page);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(envoyer.mock.calls.length).toBeLessThanOrEqual(21);
    expect(envoyer.mock.calls.at(-1)).toEqual([expect.any(Number)]);
  });
});
