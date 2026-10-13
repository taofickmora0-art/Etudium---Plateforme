// Affichage des PDF en consultation seule (spec du lot 1, §6) avec pdf.js : les pages sont dessinées dans des canvas,
// sans la barre du lecteur PDF du navigateur (téléchargement, impression). Sur Android, Chrome n'affiche pas un PDF dans
// la page : il le télécharge ; pdf.js règle aussi ce cas. Ce module ne se charge que dans le navigateur, à la demande.

export type DocumentPdf = {
  pages: number;
  /** Dessine la page `numero` (à partir de 1) à `largeur` pixels CSS, nette sur un écran haute densité. */
  dessiner(numero: number, canvas: HTMLCanvasElement, largeur: number): Promise<void>;
  /** Libère le document (mémoire, worker). */
  fermer(): void;
};

type Tache = { cancel(): void; promise: Promise<unknown> };

/** Lit un PDF déjà téléchargé (le lien temporaire peut expirer ensuite : tout est en mémoire). */
export async function ouvrirPdf(donnees: ArrayBuffer): Promise<DocumentPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const chargement = pdfjs.getDocument({ data: new Uint8Array(donnees) });
  const document = await chargement.promise;
  // Un dessin en cours sur un canvas est annulé avant le suivant (zoom rapide) : pdf.js refuse deux dessins à la fois.
  const taches = new WeakMap<HTMLCanvasElement, Tache>();
  return {
    pages: document.numPages,
    async dessiner(numero, canvas, largeur) {
      const precedente = taches.get(canvas);
      if (precedente) {
        precedente.cancel();
        await precedente.promise.catch(() => undefined);
      }
      const page = await document.getPage(numero);
      const densite = window.devicePixelRatio || 1;
      const base = page.getViewport({ scale: 1 });
      const vue = page.getViewport({ scale: (largeur / base.width) * densite });
      canvas.width = Math.floor(vue.width);
      canvas.height = Math.floor(vue.height);
      canvas.style.width = `${Math.floor(vue.width / densite)}px`;
      canvas.style.height = `${Math.floor(vue.height / densite)}px`;
      const tache = page.render({ canvas, viewport: vue });
      taches.set(canvas, tache);
      try {
        await tache.promise;
      } catch (erreur) {
        // Dessin annulé par un plus récent : ce n'est pas une erreur.
        if (!(erreur instanceof pdfjs.RenderingCancelledException)) throw erreur;
      } finally {
        if (taches.get(canvas) === tache) taches.delete(canvas);
      }
    },
    fermer() {
      void chargement.destroy();
    },
  };
}
