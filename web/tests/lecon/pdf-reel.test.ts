import { fileURLToPath } from "node:url";
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Le vrai pdf.js (pas un faux document) : ouvre un PDF fabriqué ici et dessine sa page 1. Le navigateur, lui, se
// vérifie avec le guide (section 12) ; ce test garde l'adaptateur juste quand pdf.js change de version.

/** Un PDF d'une page A4 : le mot « Etudium » et un rectangle bleu. */
function petitPdf(): ArrayBuffer {
  const flux = "BT /F1 48 Tf 72 700 Td (Etudium) Tj ET 0 0 1 rg 72 400 450 200 re f";
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let sortie = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((objet, i) => {
    positions.push(sortie.length);
    sortie += `${i + 1} 0 obj\n${objet}\nendobj\n`;
  });
  const xref = sortie.length;
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`;
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(sortie).buffer as ArrayBuffer;
}

/** Un PDF scanné en noir et blanc : une image fax (CCITT) de 8×8 pixels noirs, agrandie sur la page. */
function pdfScanne(): ArrayBuffer {
  let bits = ("00110101" + "000101").repeat(8);
  while (bits.length % 8) bits += "0";
  const image = Uint8Array.from({ length: bits.length / 8 }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2));
  const flux = "q 400 0 0 400 100 300 cm /Im1 Do Q";
  const morceaux: Uint8Array[] = [];
  const texte = (s: string) => new TextEncoder().encode(s);
  let taille = 0;
  const ajouter = (m: Uint8Array) => {
    morceaux.push(m);
    taille += m.length;
  };
  ajouter(texte("%PDF-1.4\n"));
  const positions: number[] = [];
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
  ];
  objets.forEach((o, i) => {
    positions.push(taille);
    ajouter(texte(`${i + 1} 0 obj\n${o}\nendobj\n`));
  });
  positions.push(taille);
  ajouter(
    texte(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width 8 /Height 8 /BitsPerComponent 1 /ColorSpace /DeviceGray /Filter /CCITTFaxDecode /DecodeParms << /K 0 /Columns 8 /Rows 8 /EndOfBlock false >> /Length ${image.length} >>\nstream\n`,
    ),
  );
  ajouter(image);
  ajouter(texte("\nendstream\nendobj\n"));
  const xref = taille;
  ajouter(texte(`xref\n0 6\n0000000000 65535 f \n${positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("")}`));
  ajouter(texte(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
  const tout = new Uint8Array(taille);
  let n = 0;
  for (const m of morceaux) {
    tout.set(m, n);
    n += m.length;
  }
  return tout.buffer;
}

/** Les fichiers de pdf.js servis par le site (copiés dans public/pdfjs) : ici, directement depuis node_modules. */
// pdf.js veut des chemins finissant par « / » (sous Windows, fileURLToPath donne des « \ »).
const chemin = (relatif: string) => fileURLToPath(new URL(relatif, import.meta.url)).replace(/\\/g, "/");
const RESSOURCES_PDFJS = { wasm: chemin("../../node_modules/pdfjs-dist/wasm/"), polices: chemin("../../node_modules/pdfjs-dist/standard_fonts/") };

const compter = (canvas: Canvas, test: (r: number, v: number, b: number, x: number) => boolean) => {
  const d = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) if (test(d[i], d[i + 1], d[i + 2], (i / 4) % canvas.width)) n++;
  return n;
};

describe("Adaptateur pdf.js (vrai pdf.js)", () => {
  const avant = (globalThis as { window?: unknown }).window;
  beforeAll(() => {
    // Ce dont pdf.js et l'adaptateur ont besoin d'une fenêtre de navigateur.
    (globalThis as { window?: unknown }).window = { devicePixelRatio: 2, requestAnimationFrame: (f: (t: number) => void) => setTimeout(() => f(Date.now()), 0) };
  });
  afterAll(() => {
    (globalThis as { window?: unknown }).window = avant;
  });

  it("ouvre un PDF, compte ses pages et dessine la page 1 à la largeur demandée, nette (densité 2)", async () => {
    const { ouvrirPdf } = await import("@/lib/ressources/pdf");
    const document = await ouvrirPdf(petitPdf());
    expect(document.pages).toBe(1);
    // Un canvas de Node n'a pas de style : on lui en donne un, comme celui d'une page.
    const canvas = Object.assign(createCanvas(1, 1), { style: {} as CSSStyleDeclaration });
    await document.dessiner(1, canvas as unknown as HTMLCanvasElement, 300);
    expect(canvas.width).toBe(600);
    expect(canvas.style.width).toBe("300px");
    expect(Math.round(canvas.height)).toBe(Math.floor((842 / 595) * 600));
    // Le rectangle bleu est bien dessiné.
    const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    let bleus = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 2] > 200 && pixels[i] < 60 && pixels[i + 1] < 60) bleus++;
    expect(bleus).toBeGreaterThan(10_000);
    document.fermer();
  }, 30_000);

  it("un PDF scanné en noir et blanc (image fax) s'affiche : pdf.js reçoit ses fichiers de décodage", async () => {
    const { ouvrirPdf } = await import("@/lib/ressources/pdf");
    const document = await ouvrirPdf(pdfScanne(), RESSOURCES_PDFJS);
    const canvas = Object.assign(createCanvas(1, 1), { style: {} as CSSStyleDeclaration });
    await document.dessiner(1, canvas as unknown as HTMLCanvasElement, 300);
    expect(compter(canvas, (r, v, b) => r < 50 && v < 50 && b < 50)).toBeGreaterThan(10_000);
    document.fermer();
  }, 30_000);

  it("deux dessins rapprochés sur la même page : le dernier l'emporte, à sa taille", async () => {
    const { ouvrirPdf } = await import("@/lib/ressources/pdf");
    const document = await ouvrirPdf(petitPdf(), RESSOURCES_PDFJS);
    const canvas = Object.assign(createCanvas(1, 1), { style: {} as CSSStyleDeclaration });
    const page = canvas as unknown as HTMLCanvasElement;
    // Comme un « Agrandir » pendant le premier dessin.
    await Promise.allSettled([document.dessiner(1, page, 300), document.dessiner(1, page, 600)]);
    expect(canvas.width).toBe(1200);
    // Le rectangle bleu va au-delà de x = 700 : le dessin est bien celui de 600 px (densité 2).
    expect(compter(canvas, (r, v, b, x) => b > 200 && r < 60 && v < 60 && x > 700)).toBeGreaterThan(10_000);
    document.fermer();
  }, 30_000);

  it("une page n'est jamais dessinée au-delà de 8 millions de pixels (mémoire des téléphones, limite de Safari)", async () => {
    const { ouvrirPdf } = await import("@/lib/ressources/pdf");
    const document = await ouvrirPdf(petitPdf(), RESSOURCES_PDFJS);
    const canvas = Object.assign(createCanvas(1, 1), { style: {} as CSSStyleDeclaration });
    await document.dessiner(1, canvas as unknown as HTMLCanvasElement, 2000);
    expect(canvas.width * canvas.height).toBeLessThanOrEqual(8_388_608);
    // La taille affichée, elle, reste celle demandée.
    expect(canvas.style.width).toBe("2000px");
    document.fermer();
  }, 30_000);
});

