import { describe, expect, it } from "vitest";
import { fichierIcs } from "@/lib/sessions/agenda";

// « Ajouter à mon agenda » : un fichier .ics (Google Agenda, Outlook, téléphone).

const SESSION = {
  id: "11111111-1111-4111-8111-111111111111",
  titre: "Excel, avancé; niveau 2",
  description: "Ligne 1\nLigne 2 \\ fin",
  debut: "2026-10-24T14:00:00Z",
  dureeMinutes: 60,
};

describe("Fichier d'agenda", () => {
  const ics = fichierIcs(SESSION, "https://etudium.app/evenements", new Date("2026-10-14T15:00:00Z"));

  it("un événement, heures en UTC, lignes séparées par CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VEVENT\r\nEND:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("\r\nUID:11111111-1111-4111-8111-111111111111@etudium\r\n");
    expect(ics).toContain("\r\nDTSTAMP:20261014T150000Z\r\n");
    expect(ics).toContain("\r\nDTSTART:20261024T140000Z\r\n");
    expect(ics).toContain("\r\nDTEND:20261024T150000Z\r\n");
    expect(ics).toContain("\r\nURL:https://etudium.app/evenements\r\n");
    expect(ics.split("\r\n").every((ligne) => !ligne.includes("\n"))).toBe(true);
  });

  it("virgules, points-virgules, barres obliques inversées et retours à la ligne échappés", () => {
    expect(ics).toContain("\r\nSUMMARY:Excel\\, avancé\\; niveau 2\r\n");
    expect(ics).toContain("DESCRIPTION:Ligne 1\\nLigne 2 \\\\ fin\\n\\nhttps://etudium.app/evenements\r\n");
  });
});
