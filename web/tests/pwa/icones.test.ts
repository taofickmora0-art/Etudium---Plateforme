import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

// Icônes générées depuis le logo du design par scripts/generer-icones.mjs (fichiers commités).
const fichier = (chemin: string) => join(process.cwd(), chemin);
const pixel = async (chemin: string, x: number, y: number) => {
  const { data, info } = await sharp(fichier(chemin)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
};
const proche = (couleur: number[], attendu: number[]) => attendu.every((v, i) => Math.abs(couleur[i] - v) <= 2);

describe("Icônes de l'appli", () => {
  it("les icônes ont les bonnes tailles", async () => {
    for (const [chemin, taille] of [
      ["public/icons/icone-192.png", 192],
      ["public/icons/icone-512.png", 512],
      ["public/icons/icone-masquable-512.png", 512],
      ["src/app/apple-icon.png", 180],
    ] as const) {
      const meta = await sharp(fichier(chemin)).metadata();
      expect([meta.format, meta.width, meta.height], chemin).toEqual(["png", taille, taille]);
    }
  });

  it("l'icône masquable a un fond plein", async () => {
    expect(proche(await pixel("public/icons/icone-masquable-512.png", 2, 2), [0x0b, 0x18, 0xc9, 255])).toBe(true);
  });

  it("l'icône iOS n'a pas de transparence", async () => {
    expect(proche(await pixel("src/app/apple-icon.png", 2, 2), [0xf2, 0xf6, 0xfd, 255])).toBe(true);
  });

  it("le logo est au centre de l'icône", async () => {
    // À mi-hauteur, à gauche de la lettre : l'hexagone bleu ; au centre de la lettre : du blanc.
    expect(proche(await pixel("public/icons/icone-512.png", 160, 256), [0x0b, 0x18, 0xc9, 255])).toBe(true);
  });

  it("l'onglet montre le logo Étudium", () => {
    expect(existsSync(fichier("src/app/favicon.ico"))).toBe(false);
    expect(readFileSync(fichier("src/app/icon.svg"), "utf8").toLowerCase()).toContain("#0b18c9");
  });
});
