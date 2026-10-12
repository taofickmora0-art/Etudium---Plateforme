import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import type { FicheFormation } from "@/lib/catalogue/types";
import { parSlug } from "./cartes-design";

const getFiche = vi.fn();
vi.mock("@/lib/catalogue/data", () => ({ getFiche: (slug: string) => getFiche(slug) }));

const { default: Image } = await import("@/app/(catalogue)/formations/[slug]/opengraph-image");
const FICHE: FicheFormation = { ...parSlug("maitriser-microsoft-excel"), description: "", seuilVideo: 90, objectifs: [], competences: [], formateur: null, modules: [] };

/** Pixels bleu Étudium (#0B18C9, à l'anticrénelage près) dans un carré de l'image. */
async function pixelsBleus(png: Buffer, x0: number, y0: number, cote: number) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let n = 0;
  for (let y = y0; y < y0 + cote; y++) {
    for (let x = x0; x < x0 + cote; x++) {
      const i = (y * info.width + x) * info.channels;
      if (data[i] < 90 && data[i + 1] < 90 && data[i + 2] > 150) n++;
    }
  }
  return n;
}

describe("Image du lien partagé", () => {
  it("une formation inconnue répond 404", async () => {
    getFiche.mockResolvedValue(null);
    const reponse = await Image({ params: Promise.resolve({ slug: "inconnue" }) });
    expect(reponse.status).toBe(404);
  });

  it("le « É » du logo est au centre de l'hexagone blanc", async () => {
    getFiche.mockResolvedValue(FICHE);
    const reponse = await Image({ params: Promise.resolve({ slug: FICHE.slug }) });
    expect(reponse.status).toBe(200);
    const png = Buffer.from(await reponse.arrayBuffer());
    // Le logo occupe le carré 64→124 (marge de 64 px, 60 px de côté) : son centre doit porter la lettre bleue.
    expect(await pixelsBleus(png, 84, 84, 20)).toBeGreaterThan(20);
  });
});
