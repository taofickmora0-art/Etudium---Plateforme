import { ouvrirPdf, type DocumentPdf } from "@/lib/ressources/pdf";

// Le PDF d'un livre lu dans le navigateur, avant son envoi (back-office) : son nombre de pages, et sa première page
// dessinée pour « Fabriquer à partir de la 1re page ». pdf.js est celui du lecteur des ressources (public/pdfjs).

/** Ouvre un PDF local (le fichier choisi, ou le PDF actuel téléchargé) ; le document est à fermer après usage. */
export async function lirePdfLocal(fichier: Blob, ouvrir: (donnees: ArrayBuffer) => Promise<DocumentPdf> = ouvrirPdf): Promise<DocumentPdf> {
  return ouvrir(await fichier.arrayBuffer());
}

/** Largeur de la couverture fabriquée, en pixels CSS (doublée sur un écran haute densité) : nette, et bien sous 5 Mo. */
const LARGEUR = 600;

/** La première page dessinée dans un canvas, puis en JPEG : la couverture fabriquée. */
export async function couvertureDePremierePage(
  document: DocumentPdf,
  creerCanvas: () => HTMLCanvasElement = () => window.document.createElement("canvas"),
): Promise<Blob> {
  const canvas = creerCanvas();
  await document.dessiner(1, canvas, LARGEUR);
  return new Promise<Blob>((resoudre, rejeter) => {
    canvas.toBlob((blob) => (blob ? resoudre(blob) : rejeter(new Error("La première page n’a pas pu être dessinée."))), "image/jpeg", 0.86);
  });
}
