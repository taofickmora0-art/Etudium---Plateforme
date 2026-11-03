import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { versSommaire } from "@/lib/ressources/pdf";

// Le sommaire d'un PDF (ses signets), pour le lecteur de la Bibliothèque : titre, page et sous-parties. D'abord la
// conversion seule, puis le vrai pdf.js sur un PDF fabriqué ici.

describe("La conversion du sommaire", () => {
  it("garde les titres, la page de chaque entrée et les sous-parties ; écarte une entrée sans page ni sous-partie", async () => {
    const pageDe = vi.fn(async (dest: string | unknown[]) => (dest === "chap2" ? 12 : Array.isArray(dest) && dest[0] === "ref-intro" ? 1 : null));
    const sommaire = await versSommaire(
      [
        { title: "Introduction", dest: ["ref-intro", { name: "Fit" }], items: [] },
        { title: "  Chapitre 2\u0000 ", dest: "chap2", items: [{ title: "Section 2.1", dest: "chap2", items: [] }] },
        { title: "Site de l’auteur", dest: null, items: [] },
        { title: "Annexes", dest: null, items: [{ title: "Annexe A", dest: "chap2", items: [] }] },
      ],
      pageDe,
    );
    expect(sommaire).toEqual([
      { titre: "Introduction", page: 1, enfants: [] },
      { titre: "Chapitre 2", page: 12, enfants: [{ titre: "Section 2.1", page: 12, enfants: [] }] },
      { titre: "Annexes", page: null, enfants: [{ titre: "Annexe A", page: 12, enfants: [] }] },
    ]);
  });

  it("sans signets : un sommaire vide ; une destination illisible ne casse pas le reste", async () => {
    expect(await versSommaire(null, async () => 1)).toEqual([]);
    const sommaire = await versSommaire(
      [
        { title: "Abîmé", dest: "x", items: [] },
        { title: "Sain", dest: "y", items: [] },
      ],
      async (dest) => {
        if (dest === "x") throw new Error("destination introuvable");
        return 3;
      },
    );
    expect(sommaire).toEqual([{ titre: "Sain", page: 3, enfants: [] }]);
  });

  it("trois niveaux au plus", async () => {
    const niveau = (n: number): { title: string; dest: string; items: unknown[] } => ({ title: `Niveau ${n}`, dest: "d", items: n < 6 ? [niveau(n + 1)] : [] });
    const sommaire = await versSommaire([niveau(1)] as never, async () => 2);
    expect(sommaire[0].enfants[0].enfants[0].enfants).toEqual([]);
  });
});

/** Deux pages, et des signets : « Introduction » (page 1), « Chapitre 2 » (page 2) et sa partie « Section 2.1 » (destination nommée). */
function pdfAvecSignets(): ArrayBuffer {
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R /Outlines 6 0 R /Dests 10 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R >>",
    "<< /Length 0 >>\nstream\n\nendstream",
    "<< /Type /Outlines /First 7 0 R /Last 8 0 R /Count 3 >>",
    "<< /Title (Introduction) /Parent 6 0 R /Next 8 0 R /Dest [3 0 R /Fit] >>",
    "<< /Title (Chapitre 2) /Parent 6 0 R /Prev 7 0 R /First 9 0 R /Last 9 0 R /Count 1 /Dest [4 0 R /XYZ 0 800 0] >>",
    "<< /Title (Section 2.1) /Parent 8 0 R /Dest /sec21 >>",
    "<< /sec21 [4 0 R /Fit] >>",
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

describe("Le sommaire avec le vrai pdf.js", () => {
  const avant = (globalThis as { window?: unknown }).window;
  beforeAll(() => {
    (globalThis as { window?: unknown }).window = { devicePixelRatio: 1, requestAnimationFrame: (f: (t: number) => void) => setTimeout(() => f(Date.now()), 0) };
  });
  afterAll(() => {
    (globalThis as { window?: unknown }).window = avant;
  });

  it("lit les signets d'un PDF : titres, pages (destinations directes et nommées), sous-parties", async () => {
    const { ouvrirPdf } = await import("@/lib/ressources/pdf");
    const document = await ouvrirPdf(pdfAvecSignets());
    expect(document.pages).toBe(2);
    expect(await document.sommaire?.()).toEqual([
      { titre: "Introduction", page: 1, enfants: [] },
      { titre: "Chapitre 2", page: 2, enfants: [{ titre: "Section 2.1", page: 2, enfants: [] }] },
    ]);
    document.fermer();
  }, 30_000);
});
