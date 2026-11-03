import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

// La police de Next est une macro de compilation : simulée ici pour lire les métadonnées de la mise en page.
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "--font-inter", className: "" }) }));

const { default: manifest } = await import("@/app/manifest");
const { metadata, viewport } = await import("@/app/layout");
const { config } = await import("@/proxy");

describe("Appli installable", () => {
  it("le manifeste décrit l'appli", () => {
    expect(manifest()).toMatchObject({
      name: "Étudium",
      short_name: "Étudium",
      start_url: "/accueil",
      display: "standalone",
      background_color: "#F2F6FD",
      theme_color: "#F2F6FD",
      lang: "fr",
    });
  });

  it("les conditions d'installation de Chrome : nom, adresse de départ, affichage en appli, pas d'appli native préférée", () => {
    const m = manifest();
    expect(m.name && m.short_name && m.start_url).toBeTruthy();
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(m.display);
    expect(m.prefer_related_applications).toBeUndefined();
  });

  it("l'appli s'ouvre sur l'espace connecté, pas sur la future page publique", () => {
    expect(manifest()).toMatchObject({ id: "/", start_url: "/accueil" });
  });

  it("l'appli peut tourner (tablette, vidéo en plein écran)", () => {
    expect(manifest().orientation).toBeUndefined();
  });

  it("chaque icône déclarée existe", () => {
    const icones = manifest().icons ?? [];
    for (const icone of icones) expect(existsSync(join(process.cwd(), "public", icone.src)), icone.src).toBe(true);
    expect(icones.some((i) => i.purpose === "maskable")).toBe(true);
    expect(icones.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
  });

  it("le manifeste et les icônes ne passent pas par le proxy", () => {
    const motif = new RegExp(`^${config.matcher[0]}$`);
    for (const chemin of ["/manifest.webmanifest", "/icons/icone-192.png", "/apple-icon.png", "/icon.svg"]) expect(motif.test(chemin), chemin).toBe(false);
    expect(motif.test("/accueil")).toBe(true);
  });

  it("l'iPhone reconnaît l'appli", () => {
    expect(metadata.appleWebApp).toMatchObject({ capable: true, title: "Étudium" });
    expect(viewport.themeColor).toBe("#F2F6FD");
  });
});
