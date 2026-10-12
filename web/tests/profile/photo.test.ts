import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkPhotoFile, detectImageType, PHOTO_MAX_OCTETS, squareCrop } from "@/lib/profile/photo";

// ─── Doublures : Supabase (session, stockage, table profils) et rafraîchissement de Next ───
const auth = { getUser: vi.fn() };
const stockage = { upload: vi.fn(), list: vi.fn(), remove: vi.fn(), getPublicUrl: vi.fn() };
const update = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth,
    storage: { from: () => stockage },
    from: () => ({ update: (v: unknown) => (update(v), { eq: async () => ({ error: null }) }) }),
  }),
}));
const refresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => refresh() }));

const { updatePhoto } = await import("@/lib/profile/actions");
const { IDLE } = await import("@/lib/auth/schemas");

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00];
const fichier = (octets: number[], type: string, taille?: number) => {
  const contenu = new Uint8Array(taille ?? octets.length);
  contenu.set(octets);
  return new File([contenu], "photo", { type });
};
const envoi = (f: File) => {
  const fd = new FormData();
  fd.set("photo", f);
  return updatePhoto(IDLE, fd);
};

describe("Photo de profil : règles", () => {
  it("seuls les vrais JPG et PNG sont reconnus", () => {
    expect(detectImageType(new Uint8Array(JPEG))).toBe("image/jpeg");
    expect(detectImageType(new Uint8Array(PNG))).toBe("image/png");
    expect(detectImageType(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("bonjour"))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });

  it("le recadrage garde le centre", () => {
    expect(squareCrop(1200, 800)).toEqual({ sx: 200, sy: 0, side: 800, size: 512 });
    expect(squareCrop(300, 400)).toEqual({ sx: 0, sy: 50, side: 300, size: 300 });
  });

  it("une photo d'iPhone (HEIC) est refusée avec un message clair", () => {
    expect(checkPhotoFile({ type: "image/heic", size: 1000 })).toBe("Choisissez une image JPG ou PNG.");
    expect(checkPhotoFile({ type: "image/jpeg", size: 1000 })).toBeNull();
  });
});

describe("Photo de profil : réduction", () => {
  it("la rotation des photos de téléphone est respectée", async () => {
    const { resizePhoto } = await import("@/lib/profile/resize-photo");
    const lire = vi.fn().mockRejectedValue(new Error("illisible"));
    vi.stubGlobal("createImageBitmap", lire);
    const original = new File(["x"], "photo.jpg", { type: "image/jpeg" });
    expect(await resizePhoto(original)).toBe(original);
    expect(lire).toHaveBeenCalledWith(original, { imageOrientation: "from-image" });
    vi.unstubAllGlobals();
  });
});

describe("Photo de profil : envoi", () => {
  beforeEach(() => {
    [auth.getUser, update, refresh, ...Object.values(stockage)].forEach((f) => f.mockReset());
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    stockage.upload.mockResolvedValue({ data: {}, error: null });
    stockage.getPublicUrl.mockImplementation((chemin: string) => ({ data: { publicUrl: `https://projet.supabase.co/storage/v1/object/public/photos-profil/${chemin}` } }));
    stockage.list.mockResolvedValue({ data: [{ name: "ancienne.jpg" }], error: null });
    stockage.remove.mockResolvedValue({ data: [], error: null });
  });

  it("une image trop lourde est refusée sans envoi", async () => {
    const state = await envoi(fichier(JPEG, "image/jpeg", PHOTO_MAX_OCTETS + 1));
    expect(state.message).toBe("Cette image dépasse 2 Mo. Choisissez-en une plus légère.");
    expect(stockage.upload).not.toHaveBeenCalled();
  });

  it("un texte renommé en .jpg est refusé", async () => {
    const state = await envoi(new File(["bonjour"], "photo.jpg", { type: "image/jpeg" }));
    expect(state.message).toBe("Choisissez une image JPG ou PNG.");
    expect(stockage.upload).not.toHaveBeenCalled();
  });

  it("la nouvelle photo remplace l'ancienne", async () => {
    stockage.list.mockImplementation(async () => ({ data: [{ name: "ancienne.jpg" }, { name: stockage.upload.mock.calls[0][0].split("/")[1] }], error: null }));
    const state = await envoi(fichier(JPEG, "image/jpeg"));
    expect(state.status).toBe("success");
    const [chemin, , options] = stockage.upload.mock.calls[0];
    expect(chemin).toMatch(/^u1\/[0-9a-f-]{36}\.jpg$/);
    expect(options).toMatchObject({ contentType: "image/jpeg", upsert: false, cacheControl: "604800" });
    expect(update).toHaveBeenCalledWith({ photo_url: `https://projet.supabase.co/storage/v1/object/public/photos-profil/${chemin}` });
    expect(stockage.remove).toHaveBeenCalledWith(["u1/ancienne.jpg"]);
    expect(refresh).toHaveBeenCalled();
  });
});
