import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Certificat } from "@/lib/certificats/types";

// Lot 3, étape C : le certificat en image (PNG) et en PDF (A4 paysage), générés à la demande pour son titulaire.
const lireMonCertificat = vi.fn();
vi.mock("@/lib/certificats/data", () => ({ lireMonCertificat: (id: string) => lireMonCertificat(id) }));

const { GET: image } = await import("@/app/(app)/(etudiant)/certificats/[identifiant]/image/route");
const { GET: pdf } = await import("@/app/(app)/(etudiant)/certificats/[identifiant]/pdf/route");

const ID = "ET-2026-K7Q2-M9XD";
const CERTIFICAT: Certificat = { identifiant: ID, titulaire: "Aïcha Kpadé", formation: "Maîtriser Microsoft Excel", formateur: "Dr Mireille Adjovi", parcours: "Réussite académique", delivreLe: "2026-10-15" };
const appel = (url = `http://localhost/certificats/${ID}/image`) => [new Request(url), { params: Promise.resolve({ identifiant: ID }) }] as const;

beforeEach(() => lireMonCertificat.mockReset());

describe("Le fichier du certificat", () => {
  it("pas le sien (ou introuvable) : 404, rien n'est généré", async () => {
    lireMonCertificat.mockResolvedValue(null);
    expect((await image(...appel())).status).toBe(404);
    expect((await pdf(...appel())).status).toBe(404);
  });

  it("l'image : un PNG de 1754 × 1240, privé ; à télécharger, avec son nom", async () => {
    lireMonCertificat.mockResolvedValue(CERTIFICAT);
    const reponse = await image(...appel());
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("content-type")).toBe("image/png");
    expect(reponse.headers.get("cache-control")).toContain("private");
    const meta = await sharp(Buffer.from(await reponse.arrayBuffer())).metadata();
    expect([meta.width, meta.height]).toEqual([1754, 1240]);
    const telechargee = await image(...appel(`http://localhost/certificats/${ID}/image?telecharger=1`));
    expect(telechargee.headers.get("content-disposition")).toBe(`attachment; filename="certificat-${ID}.png"`);
    expect(lireMonCertificat).toHaveBeenCalledWith(ID);
  });

  it("le PDF : une page A4 paysage avec l'image, à télécharger", async () => {
    lireMonCertificat.mockResolvedValue(CERTIFICAT);
    const reponse = await pdf(...appel(`http://localhost/certificats/${ID}/pdf`));
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("content-type")).toBe("application/pdf");
    expect(reponse.headers.get("content-disposition")).toBe(`attachment; filename="certificat-${ID}.pdf"`);
    const texte = new TextDecoder("latin1").decode(new Uint8Array(await reponse.arrayBuffer()));
    expect(texte.startsWith("%PDF-1.4")).toBe(true);
    expect(texte).toContain("/MediaBox [0 0 842 595]");
    expect(texte).toContain("/Width 1754 /Height 1240");
  });
});
