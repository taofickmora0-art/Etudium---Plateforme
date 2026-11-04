import { describe, expect, it } from "vitest";
import {
  BARRES,
  choisirFormat,
  DUREE_MAX_MS,
  DUREE_MIN_MS,
  dureeLisible,
  extensionVocale,
  libelleVocal,
  resumerOnde,
  typeDeBase,
  VOCAL_MAX_OCTETS,
} from "@/lib/vocal/regles";

// Les règles des notes vocales communes au navigateur et au serveur (migration 0076 : la base revérifie tout).

describe("Les limites", () => {
  it("1 seconde à 5 minutes, 10 Mo, une onde de 48 barres (la base en accepte 64)", () => {
    expect(DUREE_MIN_MS).toBe(1_000);
    expect(DUREE_MAX_MS).toBe(300_000);
    expect(VOCAL_MAX_OCTETS).toBe(10_485_760);
    expect(BARRES).toBe(48);
  });
});

describe("Le format d'enregistrement", () => {
  it("MP4/AAC d'abord (lisible partout, iPhone compris), puis WebM/Opus, puis Ogg ; rien si le navigateur ne sait pas", () => {
    expect(choisirFormat(() => true)).toBe("audio/mp4;codecs=mp4a.40.2");
    expect(choisirFormat((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(choisirFormat((t) => t.startsWith("audio/webm"))).toBe("audio/webm;codecs=opus");
    expect(choisirFormat((t) => t.startsWith("audio/ogg"))).toBe("audio/ogg;codecs=opus");
    expect(choisirFormat(() => false)).toBeNull();
  });

  it("le type déposé, sans ses paramètres, et son extension", () => {
    expect(typeDeBase("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(typeDeBase(" Audio/MP4 ; codecs=mp4a.40.2")).toBe("audio/mp4");
    expect(typeDeBase("")).toBe("");
    expect(extensionVocale("audio/mp4")).toBe("m4a");
    expect(extensionVocale("audio/webm")).toBe("webm");
    expect(extensionVocale("audio/ogg")).toBe("ogg");
    expect(extensionVocale("video/mp4")).toBeNull();
  });
});

describe("La durée", () => {
  it("« 0:07 », « 1:42 », « 5:00 » (à la seconde la plus proche)", () => {
    expect(dureeLisible(0)).toBe("0:00");
    expect(dureeLisible(7_400)).toBe("0:07");
    expect(dureeLisible(7_600)).toBe("0:08");
    expect(dureeLisible(102_000)).toBe("1:42");
    expect(dureeLisible(299_700)).toBe("5:00");
    expect(dureeLisible(-5)).toBe("0:00");
    expect(libelleVocal(12_400)).toBe("Note vocale (0:12)");
    expect(libelleVocal(null)).toBe("Note vocale");
  });
});

describe("L'onde", () => {
  it("ramène les niveaux mesurés à 48 barres de 0 à 100, la plus haute à 100", () => {
    const niveaux = Array.from({ length: 480 }, (_, i) => (i < 240 ? 0.1 : 0.4));
    const onde = resumerOnde(niveaux);
    expect(onde).toHaveLength(48);
    expect(Math.max(...onde)).toBe(100);
    expect(onde[0]).toBe(25);
    expect(onde.every((v) => Number.isInteger(v) && v >= 0 && v <= 100)).toBe(true);
  });

  it("moins de mesures que de barres : une barre par mesure ; aucune mesure ou du silence : des barres à zéro", () => {
    expect(resumerOnde([0.2, 0.1])).toEqual([100, 50]);
    expect(resumerOnde([])).toEqual([]);
    expect(resumerOnde([0, 0, 0])).toEqual([0, 0, 0]);
    expect(resumerOnde([Number.NaN, 0.5])).toEqual([0, 100]);
  });
});
