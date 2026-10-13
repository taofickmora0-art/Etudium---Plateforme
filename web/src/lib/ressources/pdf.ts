// Affichage des PDF en consultation seule (spec du lot 1, §6) avec pdf.js : les pages sont dessinées dans des canvas,
// sans la barre du lecteur PDF du navigateur (téléchargement, impression). Sur Android, Chrome n'affiche pas un PDF dans
// la page : il le télécharge ; pdf.js règle aussi ce cas. Ce module ne se charge que dans le navigateur, à la demande.
// Version « legacy » : la version moderne exige des navigateurs très récents (Uint8Array.toHex, Chrome 140+).

export type DocumentPdf = {
  pages: number;
  /** Hauteur ÷ largeur de la première page : la taille des pages pas encore dessinées (paysage ou portrait). */
  ratio: number;
  /** Dessine la page `numero` (à partir de 1) à `largeur` pixels CSS, nette sur un écran haute densité. */
  dessiner(numero: number, canvas: HTMLCanvasElement, largeur: number): Promise<void>;
  /** Libère le document (mémoire, worker). */
  fermer(): void;
};

/**
 * Fichiers de décodage servis par le site (copiés depuis pdfjs-dist par `scripts/copier-pdfjs.mjs`) :
 * - `wasm` : décodeurs des images de PDF scannés (fax CCITT, JBIG2, JPEG 2000) ; sans eux, ces pages restent blanches ;
 * - `polices` : polices standard des PDF qui ne les incluent pas.
 */
export type RessourcesPdfjs = { wasm: string; polices: string };
const RESSOURCES_DU_SITE: RessourcesPdfjs = { wasm: "/pdfjs/wasm/", polices: "/pdfjs/standard_fonts/" };

/** Au-delà, la densité baisse : mémoire des téléphones, et Safari refuse les canvas de plus de 16,7 millions de pixels. */
const PIXELS_MAX = 8_388_608;

type Tache = { cancel(): void; promise: Promise<unknown> };

/** Lit un PDF déjà téléchargé (le lien temporaire peut expirer ensuite : tout est en mémoire). */
export async function ouvrirPdf(donnees: ArrayBuffer, ressources: RessourcesPdfjs = RESSOURCES_DU_SITE): Promise<DocumentPdf> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  const chargement = pdfjs.getDocument({ data: new Uint8Array(donnees), wasmUrl: ressources.wasm, standardFontDataUrl: ressources.polices });
  let document;
  try {
    document = await chargement.promise;
  } catch (erreur) {
    // PDF abîmé ou protégé : on libère le worker avant de signaler l'erreur.
    void chargement.destroy();
    throw erreur;
  }
  const premiere = (await document.getPage(1)).getViewport({ scale: 1 });

  // Le dernier dessin demandé pour chaque canvas l'emporte (zoom rapide, rotation) : les précédents s'arrêtent.
  const derniers = new WeakMap<HTMLCanvasElement, object>();
  const taches = new WeakMap<HTMLCanvasElement, Tache>();
  return {
    pages: document.numPages,
    ratio: premiere.height / premiere.width,
    async dessiner(numero, canvas, largeur) {
      const jeton = {};
      derniers.set(canvas, jeton);
      const remplace = () => derniers.get(canvas) !== jeton;
      const precedente = taches.get(canvas);
      if (precedente) {
        precedente.cancel();
        await precedente.promise.catch(() => undefined);
      }
      if (remplace()) return;
      const page = await document.getPage(numero);
      if (remplace()) return;
      const base = page.getViewport({ scale: 1 });
      const echelle = largeur / base.width;
      let densite = window.devicePixelRatio || 1;
      const pixels = base.width * base.height * (echelle * densite) ** 2;
      if (pixels > PIXELS_MAX) densite *= Math.sqrt(PIXELS_MAX / pixels);
      const vue = page.getViewport({ scale: echelle * densite });
      canvas.width = Math.floor(vue.width);
      canvas.height = Math.floor(vue.height);
      canvas.style.width = `${Math.round(base.width * echelle)}px`;
      canvas.style.height = `${Math.round(base.height * echelle)}px`;
      const tache = page.render({ canvas, viewport: vue });
      taches.set(canvas, tache);
      try {
        await tache.promise;
      } catch (erreur) {
        // Dessin annulé par un plus récent : ce n'est pas une erreur.
        if (!(erreur instanceof pdfjs.RenderingCancelledException)) throw erreur;
      } finally {
        if (taches.get(canvas) === tache) taches.delete(canvas);
        // Les données décodées de la page sont libérées ; elles seront relues si la page revient à l'écran.
        page.cleanup();
      }
    },
    fermer() {
      void chargement.destroy();
    },
  };
}
