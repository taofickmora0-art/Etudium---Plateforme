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
  /** Les signets du PDF (sommaire du lecteur de la Bibliothèque) ; vide s'il n'en a pas. */
  sommaire?(): Promise<EntreeSommaire[]>;
};

/** Une entrée du sommaire d'un PDF : son titre, sa page (à partir de 1 ; null sans destination) et ses sous-parties. */
export type EntreeSommaire = { titre: string; page: number | null; enfants: EntreeSommaire[] };

/** Un signet tel que pdf.js le donne (getOutline). */
type SignetPdf = { title: string; dest: string | unknown[] | null; items?: SignetPdf[] };

/** Trois niveaux au plus, 500 entrées au plus : un sommaire reste lisible, et un PDF piégé ne bloque pas le lecteur. */
const PROFONDEUR_SOMMAIRE = 3;
const ENTREES_SOMMAIRE = 500;

/**
 * Les signets d'un PDF → le sommaire : titres nettoyés, page de chaque entrée (`pageDe` lit sa destination), sous-parties.
 * Une entrée sans page ni sous-partie (un lien vers un site) est écartée ; une destination illisible aussi, sans casser
 * le reste.
 */
export async function versSommaire(signets: SignetPdf[] | null | undefined, pageDe: (dest: string | unknown[]) => Promise<number | null>): Promise<EntreeSommaire[]> {
  let restantes = ENTREES_SOMMAIRE;
  const niveau = async (liste: SignetPdf[] | null | undefined, profondeur: number): Promise<EntreeSommaire[]> => {
    const entrees: EntreeSommaire[] = [];
    for (const signet of liste ?? []) {
      if (restantes <= 0) break;
      restantes--;
      // Les caractères de contrôle (fréquents dans les titres des PDF) sont retirés.
      const titre = String(signet?.title ?? "").replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
      let page: number | null = null;
      if (signet?.dest) {
        try {
          page = await pageDe(signet.dest);
        } catch {
          page = null;
        }
      }
      const enfants = profondeur + 1 < PROFONDEUR_SOMMAIRE ? await niveau(signet?.items, profondeur + 1) : [];
      if (!titre || (page === null && enfants.length === 0)) continue;
      entrees.push({ titre, page, enfants });
    }
    return entrees;
  };
  return niveau(signets, 0);
}

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
    async sommaire() {
      // La destination d'un signet : directe ([page, mode…]) ou nommée (à chercher dans le document) ; sa page est une
      // référence (à convertir en numéro) ou, plus rarement, déjà un numéro (à partir de 0).
      const pageDe = async (dest: string | unknown[]) => {
        const tableau = typeof dest === "string" ? await document.getDestination(dest) : dest;
        const cible: unknown = Array.isArray(tableau) ? tableau[0] : null;
        if (typeof cible === "number") return cible + 1;
        if (cible && typeof cible === "object") return (await document.getPageIndex(cible as Parameters<typeof document.getPageIndex>[0])) + 1;
        return null;
      };
      try {
        return await versSommaire((await document.getOutline()) as SignetPdf[] | null, pageDe);
      } catch {
        return [];
      }
    },
  };
}
