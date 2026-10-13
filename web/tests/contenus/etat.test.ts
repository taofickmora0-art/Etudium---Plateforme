import { describe, expect, it } from "vitest";
import { ETATS, etatFormation, TON_ETAT } from "@/lib/contenus/etat";

// État affiché d'une formation (spec de l'espace formateur, §2) : le statut enregistré, plus la relecture.

const f = (statut: "brouillon" | "publiee" | "archivee", envoyeeLe: string | null = null, renvoyeeLe: string | null = null) => ({ statut, envoyeeLe, renvoyeeLe });

describe("État d'une formation", () => {
  it("les cinq états", () => {
    expect(etatFormation(f("brouillon"))).toBe("brouillon");
    expect(etatFormation(f("brouillon", "2026-10-13T08:00:00Z"))).toBe("en_attente");
    expect(etatFormation(f("brouillon", null, "2026-10-13T08:00:00Z"))).toBe("a_corriger");
    expect(etatFormation(f("publiee"))).toBe("publiee");
    expect(etatFormation(f("archivee"))).toBe("archivee");
  });

  it("une formation publiée ou archivée garde son état, même si une date de relecture traîne", () => {
    expect(etatFormation(f("publiee", "2026-10-13T08:00:00Z"))).toBe("publiee");
    expect(etatFormation(f("archivee", null, "2026-10-13T08:00:00Z"))).toBe("archivee");
  });

  it("renvoyée puis renvoyée en relecture : en attente", () => {
    expect(etatFormation(f("brouillon", "2026-10-14T08:00:00Z", null))).toBe("en_attente");
  });

  it("les libellés et les tons", () => {
    expect(ETATS).toEqual({ brouillon: "Brouillon", en_attente: "En attente de validation", a_corriger: "À corriger", publiee: "Publiée", archivee: "Archivée" });
    expect(TON_ETAT).toEqual({ brouillon: "enAttente", en_attente: "populaire", a_corriger: "echoue", publiee: "valide", archivee: "aCorriger" });
  });
});
