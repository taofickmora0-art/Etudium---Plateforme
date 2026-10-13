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

  it("avec une couverture, l'image partagée est la couverture (cadrée en 1200 × 630)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    const rouge = await sharp({ create: { width: 64, height: 36, channels: 3, background: { r: 220, g: 20, b: 20 } } }).png().toBuffer();
    const fetch = vi.fn(async () => new Response(rouge, { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetch);
    getFiche.mockResolvedValue({ ...FICHE, couverture: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg" });
    const reponse = await Image({ params: Promise.resolve({ slug: FICHE.slug }) });
    expect(fetch).toHaveBeenCalledWith("https://projet.supabase.co/storage/v1/object/public/couvertures/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg");
    const { data, info } = await sharp(Buffer.from(await reponse.arrayBuffer())).raw().toBuffer({ resolveWithObject: true });
    const centre = (315 * info.width + 600) * info.channels;
    expect([data[centre] > 180, data[centre + 1] < 60, data[centre + 2] < 60]).toEqual([true, true, true]);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("si la couverture ne se charge pas, l'image bleue reste", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("introuvable", { status: 404 })));
    getFiche.mockResolvedValue({ ...FICHE, couverture: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg" });
    const reponse = await Image({ params: Promise.resolve({ slug: FICHE.slug }) });
    expect(await pixelsBleus(Buffer.from(await reponse.arrayBuffer()), 84, 84, 20)).toBeGreaterThan(20);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

