// Le PDF du certificat : une page A4 paysage (842 × 595 points) qui contient l'image JPEG du certificat. Écrit à la main
// (quelques objets PDF) : pas de bibliothèque à ajouter pour une seule image.

const A4_LARGEUR = 842;
const A4_HAUTEUR = 595;

/** Un PDF d'une page A4 paysage, l'image JPEG (largeur × hauteur en pixels) occupant toute la page. */
export function pdfDepuisJpeg(jpeg: Uint8Array, largeur: number, hauteur: number): Uint8Array {
  const encodeur = new TextEncoder();
  const morceaux: Uint8Array[] = [];
  const decalages: number[] = [];
  let taille = 0;
  const ajouter = (morceau: Uint8Array | string) => {
    const octets = typeof morceau === "string" ? encodeur.encode(morceau) : morceau;
    morceaux.push(octets);
    taille += octets.length;
  };
  const objet = (numero: number, contenu: string) => {
    decalages[numero - 1] = taille;
    ajouter(`${numero} 0 obj\n${contenu}\nendobj\n`);
  };

  // L'en-tête, puis une ligne d'octets non ASCII : les lecteurs savent ainsi que le fichier est binaire.
  ajouter("%PDF-1.4\n");
  ajouter(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  objet(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objet(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objet(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LARGEUR} ${A4_HAUTEUR}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  decalages[3] = taille;
  ajouter(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${largeur} /Height ${hauteur} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  ajouter(jpeg);
  ajouter("\nendstream\nendobj\n");
  const dessin = `q ${A4_LARGEUR} 0 0 ${A4_HAUTEUR} 0 0 cm /Im0 Do Q`;
  objet(5, `<< /Length ${dessin.length} >>\nstream\n${dessin}\nendstream`);

  const debutTable = taille;
  ajouter(`xref\n0 6\n0000000000 65535 f \n${decalages.map((d) => `${String(d).padStart(10, "0")} 00000 n \n`).join("")}`);
  ajouter(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${debutTable}\n%%EOF\n`);

  const pdf = new Uint8Array(taille);
  let position = 0;
  for (const morceau of morceaux) {
    pdf.set(morceau, position);
    position += morceau.length;
  }
  return pdf;
}
