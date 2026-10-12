import { describe, expect, it } from "vitest";
import { formatDuree, parseDuree } from "@/lib/admin/duree";
import { FORMATS, formatDe, RESSOURCE_MAX_OCTETS, tailleLisible } from "@/lib/admin/fichiers";
import { slugify } from "@/lib/admin/slug";
import { parseVideoUrl, videoLabel, videoLink } from "@/lib/admin/video";

const octets = (texte: string) => new TextEncoder().encode(texte);

describe("Adresse d'une formation", () => {
  it("slugify fabrique une adresse propre", () => {
    expect(slugify("Maîtriser Microsoft Excel")).toBe("maitriser-microsoft-excel");
    expect(slugify("Node.js & Vue.js")).toBe("node-js-vue-js");
    expect(slugify("L’IA, ça s’apprend !")).toBe("l-ia-ca-s-apprend");
    expect(slugify("  Business & revenus en ligne  ")).toBe("business-revenus-en-ligne");
    expect(slugify("???")).toBe("");
    const longue = slugify(`${"mot-".repeat(40)}fin`);
    expect(longue.length).toBeLessThanOrEqual(80);
    expect(longue).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slugify(`${"a".repeat(200)}b`).length).toBeLessThanOrEqual(80);
  });
});

describe("Lien d'une vidéo", () => {
  it("parseVideoUrl reconnaît YouTube sous toutes ses formes", () => {
    for (const lien of [
      "https://youtu.be/dQw4w9WgXcQ?si=x",
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s",
      "https://m.youtube.com/watch?feature=share&v=dQw4w9WgXcQ",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://www.youtube.com/embed/dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
      "youtube.com/watch?v=dQw4w9WgXcQ",
      "  https://youtu.be/dQw4w9WgXcQ  ",
    ]) {
      expect(parseVideoUrl(lien), lien).toEqual({ fournisseur: "youtube", id: "dQw4w9WgXcQ" });
    }
  });

  it("parseVideoUrl reconnaît Vimeo, public ou non répertorié", () => {
    expect(parseVideoUrl("https://vimeo.com/76979871")).toEqual({ fournisseur: "vimeo", id: "76979871" });
    expect(parseVideoUrl("https://vimeo.com/76979871/abcdef0123")).toEqual({ fournisseur: "vimeo", id: "76979871/abcdef0123" });
    expect(parseVideoUrl("https://player.vimeo.com/video/76979871?h=abcdef0123")).toEqual({ fournisseur: "vimeo", id: "76979871/abcdef0123" });
    expect(parseVideoUrl("https://vimeo.com/channels/staffpicks/76979871")).toEqual({ fournisseur: "vimeo", id: "76979871" });
  });

  it("parseVideoUrl refuse le reste", () => {
    for (const lien of ["https://exemple.com/video.mp4", "https://youtube.com/watch?v=court", "pas un lien", "", "https://youtube.com.pirate.example/watch?v=dQw4w9WgXcQ"]) {
      expect(parseVideoUrl(lien), lien).toBeNull();
    }
  });

  it("une vidéo reconnue se décrit et se réaffiche", () => {
    expect(videoLabel({ fournisseur: "youtube", id: "dQw4w9WgXcQ" })).toBe("YouTube · dQw4w9WgXcQ");
    expect(videoLabel({ fournisseur: "vimeo", id: "76979871" })).toBe("Vimeo · 76979871");
    expect(videoLink({ fournisseur: "youtube", id: "dQw4w9WgXcQ" })).toBe("https://youtu.be/dQw4w9WgXcQ");
    expect(videoLink({ fournisseur: "vimeo", id: "76979871/abcdef0123" })).toBe("https://vimeo.com/76979871/abcdef0123");
  });
});

describe("Durées", () => {
  it("parseDuree lit minutes et secondes", () => {
    expect(parseDuree("12:40")).toBe(760);
    expect(parseDuree("1:02:03")).toBe(3723);
    expect(parseDuree("45")).toBe(2700);
    expect(parseDuree("")).toBe(0);
    expect(parseDuree(" 06:10 ")).toBe(370);
    for (const faux of ["12:75", "-3", "douze", "1:2:3:4", "1:60:00"]) expect(parseDuree(faux), faux).toBeNull();
  });

  it("formatDuree écrit comme le design", () => {
    expect(formatDuree(760)).toBe("12:40");
    expect(formatDuree(370)).toBe("06:10");
    expect(formatDuree(3723)).toBe("1:02:03");
    expect(formatDuree(0)).toBe("");
  });
});

describe("Fichiers des ressources", () => {
  it("formatDe vérifie le contenu des fichiers", () => {
    expect(formatDe("guide.pdf", octets("%PDF-1.7 ..."))).toBe("application/pdf");
    expect(formatDe("guide.pdf", octets("bonjour"))).toBeNull();
    expect(formatDe("photo.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(formatDe("schema.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(formatDe("photo.webp", octets("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(formatDe("donnees.xlsx", octets("PK\x03\x04"))).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(formatDe("NOTES.TXT", octets("bonjour"))).toBe("text/plain");
    expect(formatDe("script.exe", octets("MZ"))).toBeNull();
    expect(formatDe("sans-extension", octets("%PDF-1.7"))).toBeNull();
  });

  it("seuls PDF et images sont consultables", () => {
    const consultables = FORMATS.filter((f) => f.consultable).map((f) => f.mime);
    expect(consultables.sort()).toEqual(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
    expect(RESSOURCE_MAX_OCTETS).toBe(52428800);
  });

  it("tailleLisible", () => {
    expect(tailleLisible(84000)).toBe("84 Ko");
    expect(tailleLisible(1200000)).toBe("1,2 Mo");
    expect(tailleLisible(500)).toBe("1 Ko");
  });
});
