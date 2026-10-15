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

  it("l'icône iOS n'a pas de transparence : le symbole blanc sur le bleu", async () => {
    expect(proche(await pixel("src/app/apple-icon.png", 2, 2), [0x0b, 0x18, 0xc9, 255])).toBe(true);
  });

  it("le symbole (le « e » au chapeau) est blanc sur une tuile bleue arrondie", async () => {
    // Coin : transparent (tuile arrondie) ; bord gauche à mi-hauteur : la tuile bleue ; ailleurs, une part de blanc.
    expect((await pixel("public/icons/icone-512.png", 2, 2))[3]).toBe(0);
    expect(proche(await pixel("public/icons/icone-512.png", 30, 256), [0x0b, 0x18, 0xc9, 255])).toBe(true);
    const { data } = await sharp(fichier("public/icons/icone-512.png")).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let blancs = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240 && data[i + 3] === 255) blancs++;
    const part = blancs / (512 * 512);
    expect(part).toBeGreaterThan(0.08);
    expect(part).toBeLessThan(0.4);
  });

  it("l'onglet montre le logo Étudium", () => {
    expect(existsSync(fichier("src/app/favicon.ico"))).toBe(false);
    const icone = readFileSync(fichier("src/app/icon.svg"), "utf8").toLowerCase();
    expect(icone).toContain("#0b18c9");
    // Le nouveau symbole : un tracé, plus l'hexagone ni la lettre « É ».
    expect(icone).toContain("<path");
    expect(icone).not.toMatch(/<polygon|<text/);
  });
});
