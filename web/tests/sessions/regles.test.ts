import { describe, expect, it } from "vitest";
import {
  champsDepuis,
  dansJours,
  dateSession,
  debutDepuis,
  DUREES,
  dureeLisible,
  enCours,
  FENETRE_LIEN_MIN,
  jourCarte,
  libelleInscriptions,
  phraseSession,
  refusSession,
  terminee,
} from "@/lib/sessions/regles";
import type { DonneesSession } from "@/lib/sessions/types";

// Heure du Bénin : UTC+1 toute l'année. MAINTENANT = 14 oct. 2026, 16 h 00 au Bénin.
const MAINTENANT = new Date("2026-10-14T15:00:00Z");
const D: DonneesSession = {
  titre: "Excel avancé",
  description: "",
  date: "2026-10-24",
  heure: "15:00",
  dureeMinutes: 60,
  lien: "https://meet.google.com/abc-defg-hij",
  parcoursId: null,
  formateurId: null,
};

describe("Dates des sessions", () => {
  it("dateSession, phraseSession, jourCarte, à l'heure du Bénin", () => {
    expect(dateSession("2026-10-24T14:00:00Z")).toBe("Samedi 24 octobre · 15 h 00");
    expect(phraseSession("2026-10-24T14:00:00Z")).toBe("samedi 24 octobre à 15 h 00");
    expect(phraseSession("2026-08-03T08:05:00Z")).toBe("lundi 3 août à 9 h 05");
    expect(jourCarte("2026-10-24T14:00:00Z")).toEqual({ mois: "OCT.", jour: "24" });
    // 23 h 30 UTC le 24 : déjà le 25 au Bénin.
    expect(jourCarte("2026-10-24T23:30:00Z")).toEqual({ mois: "OCT.", jour: "25" });
    expect(dateSession("2026-10-24T23:30:00Z")).toBe("Dimanche 25 octobre · 0 h 30");
    expect(jourCarte("2026-08-03T08:00:00Z")).toEqual({ mois: "AOÛT", jour: "3" });
    expect(jourCarte("2026-02-03T08:00:00Z")).toEqual({ mois: "FÉVR.", jour: "3" });
  });

  it("dansJours : Aujourd’hui, Demain, Dans 2 jours, au jour du Bénin", () => {
    expect(dansJours("2026-10-14T20:00:00Z", MAINTENANT)).toBe("Aujourd’hui");
    expect(dansJours("2026-10-14T23:30:00Z", MAINTENANT)).toBe("Demain"); // 0 h 30 le 15 au Bénin
    expect(dansJours("2026-10-16T09:00:00Z", MAINTENANT)).toBe("Dans 2 jours");
    expect(dansJours("2026-10-14T13:00:00Z", MAINTENANT)).toBe("Aujourd’hui"); // déjà commencée
  });

  it("en cours, terminée", () => {
    const s = { debut: "2026-10-14T14:30:00Z", dureeMinutes: 60 };
    expect([enCours(s, MAINTENANT), terminee(s, MAINTENANT)]).toEqual([true, false]);
    expect([enCours({ ...s, debut: "2026-10-14T13:00:00Z" }, MAINTENANT), terminee({ ...s, debut: "2026-10-14T13:00:00Z" }, MAINTENANT)]).toEqual([false, true]);
    expect(FENETRE_LIEN_MIN).toBe(10);
  });

  it("debutDepuis et champsDepuis, en aller-retour à l'heure du Bénin", () => {
    expect(debutDepuis("2026-10-24", "15:00")).toBe("2026-10-24T15:00:00+01:00");
    expect(debutDepuis("", "15:00")).toBeNull();
    expect(debutDepuis("2026-10-24", "15h")).toBeNull();
    expect(champsDepuis("2026-10-24T14:00:00Z")).toEqual({ date: "2026-10-24", heure: "15:00" });
    expect(champsDepuis("2026-10-24T23:30:00Z")).toEqual({ date: "2026-10-25", heure: "00:30" });
    expect(new Date(debutDepuis("2026-10-25", "00:30")!).toISOString()).toBe("2026-10-24T23:30:00.000Z");
  });
});

describe("Règles des sessions", () => {
  it("durées : de 30 min à 4 h par quarts d'heure ; libellés", () => {
    expect(DUREES[0]).toBe(30);
    expect(DUREES.at(-1)).toBe(240);
    expect(DUREES).toHaveLength(15);
    expect([dureeLisible(30), dureeLisible(60), dureeLisible(75), dureeLisible(240)]).toEqual(["30 min", "1 h", "1 h 15", "4 h"]);
  });

  it("refusSession : les messages de la base, dans le même ordre", () => {
    expect(refusSession(D, MAINTENANT)).toBeNull();
    expect(refusSession({ ...D, titre: "  " }, MAINTENANT)).toBe("Écrivez un titre (120 caractères au plus).");
    expect(refusSession({ ...D, titre: "t".repeat(121) }, MAINTENANT)).toBe("Écrivez un titre (120 caractères au plus).");
    expect(refusSession({ ...D, description: "x".repeat(1001) }, MAINTENANT)).toBe("La description dépasse 1 000 caractères.");
    expect(refusSession({ ...D, date: "" }, MAINTENANT)).toBe("Choisissez une date au moins 10 minutes dans le futur.");
    expect(refusSession({ ...D, date: "2026-10-14", heure: "16:09" }, MAINTENANT)).toBe("Choisissez une date au moins 10 minutes dans le futur.");
    expect(refusSession({ ...D, date: "2027-11-01" }, MAINTENANT)).toBe("Choisissez une date dans l’année qui vient.");
    expect(refusSession({ ...D, dureeMinutes: 50 }, MAINTENANT)).toBe("Choisissez une durée de 30 minutes à 4 heures, par quarts d’heure.");
    expect(refusSession({ ...D, lien: "http://meet.google.com/x" }, MAINTENANT)).toBe("Le lien doit commencer par https://");
    expect(refusSession({ ...D, lien: "https://meet.google.com/a b" }, MAINTENANT)).toBe("Le lien doit commencer par https://");
  });

  it("refusSession sans vérifier le début (modification d'une session en cours) : la date passée est acceptée", () => {
    expect(refusSession({ ...D, date: "2026-10-14", heure: "15:30" }, MAINTENANT, { verifierDebut: false })).toBeNull();
    expect(refusSession({ ...D, date: "" }, MAINTENANT, { verifierDebut: false })).toBe("Choisissez une date au moins 10 minutes dans le futur.");
  });

  it("libelleInscriptions : neutre", () => {
    expect([libelleInscriptions(0), libelleInscriptions(1), libelleInscriptions(128)]).toEqual(["0 inscription", "1 inscription", "128 inscriptions"]);
  });
});
