import { describe, expect, it } from "vitest";
import { motifsImages, urlCouverture } from "@/lib/couvertures/adresse";
import { COUVERTURE_MAX_OCTETS, cheminValide, detecterImage, extensionDe, verifierCouverture } from "@/lib/couvertures/regles";

const octets = (...valeurs: number[]) => Uint8Array.from([...valeurs, ...new Array(Math.max(0, 12 - valeurs.length)).fill(0)]);
const texte = (s: string) => new TextEncoder().encode(s.padEnd(12, " "));
const JPEG = octets(0xff, 0xd8, 0xff, 0xe0);
const PNG = octets(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP = octets(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);
const F = "11111111-1111-4111-8111-111111111111";
const U = "22222222-2222-4222-8222-222222222222";

describe("Couvertures : règles", () => {
  it("le format se reconnaît à la signature du fichier : JPG, PNG, WebP ; un PDF, un GIF ou un son sont refusés", () => {
    expect(detecterImage(JPEG)).toBe("image/jpeg");
    expect(detecterImage(PNG)).toBe("image/png");
    expect(detecterImage(WEBP)).toBe("image/webp");
    expect(detecterImage(texte("%PDF-1.7"))).toBeNull();
    expect(detecterImage(texte("GIF89a"))).toBeNull();
    expect(detecterImage(texte("RIFF....WAVE"))).toBeNull();
    expect([extensionDe("image/jpeg"), extensionDe("image/png"), extensionDe("image/webp")]).toEqual(["jpg", "png", "webp"]);
  });

  it("5 Mo au plus ; les messages", () => {
    expect(COUVERTURE_MAX_OCTETS).toBe(5 * 1024 * 1024);
    expect(verifierCouverture({ size: COUVERTURE_MAX_OCTETS }, JPEG)).toEqual({ ok: true, type: "image/jpeg", extension: "jpg" });
    expect(verifierCouverture({ size: COUVERTURE_MAX_OCTETS + 1 }, JPEG)).toEqual({ ok: false, erreur: "L’image dépasse 5 Mo." });
    expect(verifierCouverture({ size: 10 }, texte("%PDF-1.7"))).toEqual({ ok: false, erreur: "Choisissez une image JPG, PNG ou WebP." });
  });

  it("le chemin : un fichier du dossier de la formation, en JPG, PNG ou WebP", () => {
    expect(cheminValide(F, `${F}/${U}.webp`)).toBe(true);
    expect(cheminValide(F, `${U}/${U}.jpg`)).toBe(false);
    expect(cheminValide(F, `${F}/sous/${U}.jpg`)).toBe(false);
    expect(cheminValide(F, `${F}/${U}.gif`)).toBe(false);
    expect(cheminValide("abc", `abc/${U}.jpg`)).toBe(false);
  });

  it("l'adresse publique d'une couverture, et les adresses autorisées pour les images", () => {
    expect(urlCouverture(`${F}/${U}.jpg`, "https://projet.supabase.co")).toBe(`https://projet.supabase.co/storage/v1/object/public/couvertures/${F}/${U}.jpg`);
    expect(urlCouverture(null, "https://projet.supabase.co")).toBeNull();
    expect(urlCouverture(`${F}/${U}.jpg`, "")).toBeNull();
    expect(motifsImages("https://projet.supabase.co")).toEqual([{ protocol: "https", hostname: "projet.supabase.co", pathname: "/storage/v1/object/public/couvertures/**" }]);
    expect(motifsImages(undefined)).toEqual([]);
  });
});
