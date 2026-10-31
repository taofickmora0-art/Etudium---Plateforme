import { describe, expect, it } from "vitest";
import { decalageGmt, FUSEAU_BENIN, fuseauValide } from "@/lib/dates/fuseau";
import { commenceDans, champsDepuis, dateSession, debutDepuis, jourCarte, phraseSession } from "@/lib/sessions/regles";
import { heure } from "@/lib/notifications/temps";

// Les heures des lives dans le fuseau de chacun (liste du 31 octobre 2026, tâche 10) : l'heure est fixée une fois pour
// toutes (en UTC dans la base) ; chacun la lit à l'heure de son appareil, avec son décalage GMT.

const LIVE = "2026-10-24T14:00:00Z"; // 15 h au Bénin, 14 h au Togo, 19 h 30 en Inde

describe("Les fuseaux", () => {
  it("le décalage GMT : « GMT+1 » au Bénin, « GMT » au Togo, avec les demi-heures", () => {
    expect(decalageGmt(LIVE)).toBe("GMT+1");
    expect(decalageGmt(LIVE, "Africa/Lome")).toBe("GMT");
    expect(decalageGmt(LIVE, "Asia/Kolkata")).toBe("GMT+5:30");
    expect(decalageGmt(LIVE, "America/Sao_Paulo")).toBe("GMT-3");
  });

  it("un fuseau valide : un nom connu ; sinon non (et le Bénin par défaut)", () => {
    expect(FUSEAU_BENIN).toBe("Africa/Porto-Novo");
    expect(fuseauValide("Africa/Lome")).toBe(true);
    expect(fuseauValide("Pas/Un_Fuseau")).toBe(false);
    expect(fuseauValide("")).toBe(false);
    expect(fuseauValide(42)).toBe(false);
  });

  it("le même live, lu au Bénin, au Togo et en Inde", () => {
    expect(dateSession(LIVE)).toBe("Samedi 24 octobre · 15 h 00");
    expect(dateSession(LIVE, "Africa/Lome")).toBe("Samedi 24 octobre · 14 h 00");
    expect(phraseSession(LIVE, "Asia/Kolkata")).toBe("samedi 24 octobre à 19 h 30");
    expect(heure(LIVE, "Africa/Lome")).toBe("14 h 00");
    // 23 h 30 UTC : déjà le 25 au Bénin, encore le 24 au Togo.
    expect(jourCarte("2026-10-24T23:30:00Z")).toEqual({ mois: "OCT.", jour: "25" });
    expect(jourCarte("2026-10-24T23:30:00Z", "Africa/Lome")).toEqual({ mois: "OCT.", jour: "24" });
  });

  it("la saisie du formateur dans son fuseau : aller-retour, heure d'été comprise", () => {
    expect(debutDepuis("2026-10-24", "14:00", "Africa/Lome")).toBe("2026-10-24T14:00:00+00:00");
    expect(new Date(debutDepuis("2026-10-24", "19:30", "Asia/Kolkata")!).toISOString()).toBe("2026-10-24T14:00:00.000Z");
    expect(champsDepuis(LIVE, "Africa/Lome")).toEqual({ date: "2026-10-24", heure: "14:00" });
    // Paris : heure d'été jusqu'au 25 octobre 2026 (UTC+2), puis d'hiver (UTC+1).
    expect(debutDepuis("2026-10-24", "16:00", "Europe/Paris")).toBe("2026-10-24T16:00:00+02:00");
    expect(debutDepuis("2026-10-26", "16:00", "Europe/Paris")).toBe("2026-10-26T16:00:00+01:00");
    // Sans fuseau : le Bénin, comme avant.
    expect(debutDepuis("2026-10-24", "15:00")).toBe("2026-10-24T15:00:00+01:00");
  });
});

describe("Commence dans…", () => {
  const debut = new Date("2026-10-24T14:00:00Z");
  const avant = (minutes: number) => new Date(debut.getTime() - minutes * 60_000);
  it("en minutes, en heures, en jours", () => {
    expect(commenceDans(debut.toISOString(), avant(0.5))).toBe("moins d’une minute");
    expect(commenceDans(debut.toISOString(), avant(1))).toBe("1 min");
    expect(commenceDans(debut.toISOString(), avant(45))).toBe("45 min");
    expect(commenceDans(debut.toISOString(), avant(60))).toBe("1 h");
    expect(commenceDans(debut.toISOString(), avant(135))).toBe("2 h 15");
    expect(commenceDans(debut.toISOString(), avant(24 * 60))).toBe("1 jour");
    expect(commenceDans(debut.toISOString(), avant(28 * 60 + 10))).toBe("1 jour et 4 h");
    expect(commenceDans(debut.toISOString(), avant(3 * 24 * 60 + 30))).toBe("3 jours");
  });
});
