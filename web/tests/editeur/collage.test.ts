import { describe, expect, it } from "vitest";
import { imagesAColler } from "@/lib/editeur/collage";

// Coller dans l'éditeur riche (relecture finale, point 8) : Excel et Word mettent une image des cellules à côté du
// tableau ; c'est le tableau (le texte) qui doit entrer, pas l'image. Une image seule (capture d'écran) part en envoi.

const presse = (fichiers: File[], donnees: Record<string, string>) => ({ files: fichiers, getData: (type: string) => donnees[type] ?? "" });
const png = new File([new Uint8Array(8)], "image.png", { type: "image/png" });
const pdf = new File([new Uint8Array(8)], "doc.pdf", { type: "application/pdf" });

describe("Ce qui part en image au collage", () => {
  it("une capture d'écran seule : l'image", () => {
    expect(imagesAColler(presse([png], {}))).toEqual([png]);
    expect(imagesAColler(presse([png], { "text/html": "<meta charset='utf-8'><img src='blob:x'>" }))).toEqual([png]);
  });

  it("un tableau d'Excel ou de Word avec son image : rien (le tableau entre comme texte)", () => {
    expect(imagesAColler(presse([png], { "text/html": "<table><tr><td>Janvier</td></tr></table>", "text/plain": "Janvier" }))).toEqual([]);
    expect(imagesAColler(presse([png], { "text/plain": "Un paragraphe" }))).toEqual([]);
  });

  it("un fichier qui n'est pas une image : rien", () => {
    expect(imagesAColler(presse([pdf], {}))).toEqual([]);
    expect(imagesAColler(null)).toEqual([]);
  });
});
