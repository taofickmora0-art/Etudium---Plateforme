import { describe, expect, it } from "vitest";
import { grouperParJour, heure, libelleJour, quand } from "@/lib/notifications/temps";

// Heure du Bénin : UTC+1 toute l'année. MAINTENANT = 14 oct. 2026, 16 h 00 au Bénin.
const MAINTENANT = new Date("2026-10-14T15:00:00Z");

describe("Temps des notifications", () => {
  it("quand : À l’instant, Il y a 5 min, Il y a 2 h, Hier, puis la date", () => {
    expect(quand("2026-10-14T14:59:30Z", MAINTENANT)).toBe("À l’instant");
    expect(quand("2026-10-14T15:00:20Z", MAINTENANT)).toBe("À l’instant"); // horloge en avance
    expect(quand("2026-10-14T14:55:00Z", MAINTENANT)).toBe("Il y a 5 min");
    expect(quand("2026-10-14T13:00:00Z", MAINTENANT)).toBe("Il y a 2 h");
    expect(quand("2026-10-14T13:01:00Z", MAINTENANT)).toBe("Il y a 1 h");
    expect(quand("2026-10-13T20:00:00Z", MAINTENANT)).toBe("Hier");
    expect(quand("2026-10-12T09:00:00Z", MAINTENANT)).toBe("12 oct. 2026");
  });

  it("minuit au Bénin : 23 h 50 la veille, lu à 0 h 10, c'est Hier ; 0 h 30 lu à 1 h 30, c'est aujourd'hui", () => {
    const minuitDix = new Date("2026-10-13T23:10:00Z"); // 14 oct., 0 h 10 au Bénin
    expect(quand("2026-10-13T22:50:00Z", minuitDix)).toBe("Hier"); // 13 oct., 23 h 50 au Bénin
    expect(libelleJour("2026-10-13T22:50:00Z", minuitDix)).toBe("Hier");
    expect(quand("2026-10-13T23:30:00Z", new Date("2026-10-14T00:30:00Z"))).toBe("Il y a 1 h");
  });

  it("heure : « 14 h 05 », « 9 h 05 », à l'heure du Bénin", () => {
    expect(heure("2026-10-14T13:05:00Z")).toBe("14 h 05");
    expect(heure("2026-10-14T08:05:00Z")).toBe("9 h 05");
  });

  it("libelleJour : Aujourd’hui, Hier, puis la date", () => {
    expect(libelleJour("2026-10-14T08:00:00Z", MAINTENANT)).toBe("Aujourd’hui");
    expect(libelleJour("2026-10-13T08:00:00Z", MAINTENANT)).toBe("Hier");
    expect(libelleJour("2026-10-12T08:00:00Z", MAINTENANT)).toBe("12 oct. 2026");
  });

  it("grouperParJour : un groupe par jour, dans l'ordre reçu", () => {
    const lignes = [
      { id: "4", creeLe: "2026-10-14T14:00:00Z" },
      { id: "3", creeLe: "2026-10-14T10:00:00Z" },
      { id: "2", creeLe: "2026-10-13T08:00:00Z" },
      { id: "1", creeLe: "2026-10-12T08:00:00Z" },
    ];
    expect(grouperParJour(lignes, MAINTENANT)).toEqual([
      { cle: "2026-10-14", libelle: "Aujourd’hui", lignes: [lignes[0], lignes[1]] },
      { cle: "2026-10-13", libelle: "Hier", lignes: [lignes[2]] },
      { cle: "2026-10-12", libelle: "12 oct. 2026", lignes: [lignes[3]] },
    ]);
    expect(grouperParJour([], MAINTENANT)).toEqual([]);
  });
});
