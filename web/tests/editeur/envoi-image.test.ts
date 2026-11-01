import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { envoyerImage } from "@/lib/editeur/envoi-image";

// L'envoi d'une image du contenu riche (fin du lot 4, spec §1.2) : JPEG, PNG ou WebP (lus dans le fichier, pas dans son
// nom), 5 Mo au plus, dans le dossier de la formation de l'espace privé `images_lecons`, puis un lien signé d'une heure.

const F = "11111111-1111-4111-8111-111111111111";
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
const fichier = (octets: Uint8Array, nom: string, taille?: number) => {
  const contenu = taille ? new Uint8Array(taille) : octets;
  if (taille) contenu.set(octets);
  return new File([contenu as BlobPart], nom, { type: "image/webp" });
};

function faux(erreurEnvoi: unknown = null) {
  const upload = vi.fn(async () => ({ data: {}, error: erreurEnvoi }));
  const createSignedUrl = vi.fn(async (chemin: string) => ({ data: { signedUrl: `https://s/${chemin}` }, error: null }));
  const from = vi.fn(() => ({ upload, createSignedUrl }));
  return { client: { storage: { from } } as unknown as SupabaseClient, from, upload, createSignedUrl };
}

describe("Envoyer une image", () => {
  it("une image WebP : dans le dossier de la formation, puis son lien signé", async () => {
    const f = faux();
    const r = await envoyerImage(F, fichier(WEBP, "capture.webp"), f.client);
    expect(f.from).toHaveBeenCalledWith("images_lecons");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.chemin).toMatch(new RegExp(`^${F}/[0-9a-f-]{36}\\.webp$`));
    expect(r.url).toBe(`https://s/${r.chemin}`);
    expect(f.upload).toHaveBeenCalledWith(r.chemin, expect.any(Blob), { contentType: "image/webp", upsert: false });
    expect(f.createSignedUrl).toHaveBeenCalledWith(r.chemin, 3600);
  });

  it("le format se lit dans le fichier : un PNG nommé .webp part en PNG ; un autre format est refusé", async () => {
    const f = faux();
    const r = await envoyerImage(F, fichier(PNG, "faux.webp"), f.client);
    expect(r.ok && r.chemin.endsWith(".png")).toBe(true);
    expect(await envoyerImage(F, fichier(new Uint8Array(16), "texte.webp"), f.client)).toEqual({ ok: false, message: "Format accepté : JPEG, PNG ou WebP." });
  });

  it("plus de 5 Mo : refusée sans envoi", async () => {
    const f = faux();
    expect(await envoyerImage(F, fichier(WEBP, "grande.webp", 5_242_881), f.client)).toEqual({ ok: false, message: "L’image dépasse 5 Mo." });
    expect(f.upload).not.toHaveBeenCalled();
  });

  it("un dépôt refusé : un message", async () => {
    const f = faux({ message: "new row violates row-level security policy" });
    expect(await envoyerImage(F, fichier(WEBP, "capture.webp"), f.client)).toEqual({ ok: false, message: "L’image n’a pas pu être envoyée. Réessayez." });
  });
});
