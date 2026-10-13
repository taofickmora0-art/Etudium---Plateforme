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
    // La couverture est demandée avec un délai maximal (une couverture lente ne bloque pas l'aperçu).
    expect(fetch).toHaveBeenCalledWith("https://projet.supabase.co/storage/v1/object/public/couvertures/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(reponse.headers.get("content-type")).toBe("image/jpeg");
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

  /** Prépare une couverture servie par le faux stockage, et rend l'image partagée produite. */
  async function partager(couverture: Buffer, type: string) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://projet.supabase.co");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new Uint8Array(couverture), { headers: { "content-type": type } })));
    getFiche.mockResolvedValue({ ...FICHE, couverture: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg" });
    const reponse = await Image({ params: Promise.resolve({ slug: FICHE.slug }) });
    const octets = Buffer.from(await reponse.arrayBuffer());
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    return { reponse, octets };
  }
  const couleur = async (png: Buffer, x: number, y: number) => {
    const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const i = (y * info.width + x) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };

  it("une photo de téléphone (orientation EXIF) est redressée, comme sur le site", async () => {
    // Stockée couchée (160 × 90 : moitié gauche rouge, moitié droite bleue) avec l'orientation 6 (à tourner de 90°) :
    // redressée, le rouge est en haut et le bleu en bas.
    const moities = Buffer.alloc(160 * 90 * 3);
    for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) moities.set(x < 80 ? [220, 20, 20] : [20, 20, 220], (y * 160 + x) * 3);
    const photo = await sharp(moities, { raw: { width: 160, height: 90, channels: 3 } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const { octets } = await partager(photo, "image/jpeg");
    const [, , bleuEnBas] = await couleur(octets, 300, 560);
    const [rougeEnHaut] = await couleur(octets, 300, 70);
    expect(bleuEnBas).toBeGreaterThan(150);
    expect(rougeEnHaut).toBeGreaterThan(150);
  });

  it("une grande photo donne une image légère (moins de 300 Ko, au-delà WhatsApp n'affiche pas l'aperçu)", async () => {
    const largeur = 3000;
    const hauteur = 2000;
    const degrade = Buffer.alloc(largeur * hauteur * 3);
    for (let y = 0; y < hauteur; y++) for (let x = 0; x < largeur; x++) degrade.set([(x * 255) / largeur, (y * 255) / hauteur, 128], (y * largeur + x) * 3);
    const grande = await sharp(degrade, { raw: { width: largeur, height: hauteur, channels: 3 } }).png().toBuffer();
    const { reponse, octets } = await partager(grande, "image/png");
    expect(reponse.headers.get("content-type")).toBe("image/jpeg");
    expect(octets.length).toBeLessThan(300 * 1024);
    const meta = await sharp(octets).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
  });

  it("une couverture WebP est utilisée elle aussi", async () => {
    const verte = await sharp({ create: { width: 64, height: 36, channels: 3, background: { r: 20, g: 200, b: 20 } } }).webp().toBuffer();
    const { octets } = await partager(verte, "image/webp");
    const [r, v, b] = await couleur(octets, 600, 315);
    expect([r < 80, v > 150, b < 80]).toEqual([true, true, true]);
  });

  it("l'image bleue (sans couverture) est elle aussi en JPEG, comme annoncé", async () => {
    getFiche.mockResolvedValue(FICHE);
    const reponse = await Image({ params: Promise.resolve({ slug: FICHE.slug }) });
    expect(reponse.headers.get("content-type")).toBe("image/jpeg");
    const { contentType } = await import("@/app/(catalogue)/formations/[slug]/opengraph-image");
    expect(contentType).toBe("image/jpeg");
  });
});
