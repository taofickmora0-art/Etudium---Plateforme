import { describe, expect, it } from "vitest";
import { fichierIcs, lienGoogleAgenda } from "@/lib/sessions/agenda";

// « Ajouter à mon agenda » : Google Agenda, et un fichier .ics pour les autres agendas (Apple, Outlook).

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

  it("une alerte 10 min avant le début", () => {
    expect(ics).toContain("\r\nBEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Excel\\, avancé\\; niveau 2\r\nTRIGGER:-PT10M\r\nEND:VALARM\r\nEND:VEVENT\r\n");
  });
});

describe("Google Agenda", () => {
  const lien = new URL(lienGoogleAgenda(SESSION, "https://etudium.app/evenements"));

  it("l'adresse de création d'un événement, début et fin en UTC", () => {
    expect(`${lien.origin}${lien.pathname}`).toBe("https://calendar.google.com/calendar/render");
    expect(lien.searchParams.get("action")).toBe("TEMPLATE");
    expect(lien.searchParams.get("dates")).toBe("20261024T140000Z/20261024T150000Z");
  });

  it("titre, description et lieu encodés tels quels (rien d'autre que la session)", () => {
    expect(lien.searchParams.get("text")).toBe("Excel, avancé; niveau 2");
    expect(lien.searchParams.get("details")).toBe("Ligne 1\nLigne 2 \\ fin\n\nhttps://etudium.app/evenements");
    expect(lien.searchParams.get("location")).toBe("https://etudium.app/evenements");
    expect([...lien.searchParams.keys()]).toEqual(["action", "text", "dates", "details", "location"]);
  });
});
