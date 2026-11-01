import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { signerImages } from "@/lib/lecon/images";

// Les liens signés des images d'une leçon (fin du lot 4, spec §1.2) : un seul appel pour toutes, une heure de validité.

function faux(reponse: { data: { path: string | null; signedUrl: string; error: string | null }[] | null; error: unknown }) {
  const createSignedUrls = vi.fn(async () => reponse);
  const from = vi.fn(() => ({ createSignedUrls }));
  return { client: { storage: { from } } as unknown as SupabaseClient, from, createSignedUrls };
}

describe("Signer les images", () => {
  it("un seul appel ; chaque chemin avec son lien ; un chemin sans lien est laissé de côté", async () => {
    const f = faux({
      data: [
        { path: "a/1.webp", signedUrl: "https://s/1", error: null },
        { path: "a/2.webp", signedUrl: "", error: "Object not found" },
      ],
      error: null,
    });
    expect(await signerImages(f.client, ["a/1.webp", "a/2.webp", "a/1.webp"])).toEqual({ "a/1.webp": "https://s/1" });
    expect(f.from).toHaveBeenCalledWith("images_lecons");
    expect(f.createSignedUrls).toHaveBeenCalledTimes(1);
    expect(f.createSignedUrls).toHaveBeenCalledWith(["a/1.webp", "a/2.webp"], 3600);
  });

  it("aucune image : aucun appel ; une erreur : rien", async () => {
    const vide = faux({ data: [], error: null });
    expect(await signerImages(vide.client, [])).toEqual({});
    expect(vide.createSignedUrls).not.toHaveBeenCalled();
    const ko = faux({ data: null, error: { message: "boom" } });
    expect(await signerImages(ko.client, ["a/1.webp"])).toEqual({});
  });
});
