// Fichiers des ressources (spec du lot 1, §6). La même liste est recopiée dans la migration 0005 (types acceptés par
// l'espace de stockage « ressources ») : un test vérifie que les deux restent identiques.

/** 50 Mo, la limite par fichier du plan gratuit de Supabase. */
export const RESSOURCE_MAX_OCTETS = 52428800;

export type FormatRessource = {
  mime: string;
  extensions: string[];
  label: string;
  /** Peut être en consultation seule (visualiseur intégré) : PDF et images. */
  consultable: boolean;
  /** Premiers octets attendus ; sans signature, seule l'extension compte. */
  signature?: (octets: Uint8Array) => boolean;
};

const commencePar = (octets: Uint8Array, attendu: number[], depart = 0) => attendu.every((o, i) => octets[depart + i] === o);
const ascii = (texte: string) => [...texte].map((c) => c.charCodeAt(0));
const ZIP = (o: Uint8Array) => commencePar(o, [0x50, 0x4b, 0x03, 0x04]);
const OLE = (o: Uint8Array) => commencePar(o, [0xd0, 0xcf, 0x11, 0xe0]);

export const FORMATS: FormatRessource[] = [
  { mime: "application/pdf", extensions: ["pdf"], label: "PDF", consultable: true, signature: (o) => commencePar(o, ascii("%PDF")) },
  { mime: "image/jpeg", extensions: ["jpg", "jpeg"], label: "JPG", consultable: true, signature: (o) => commencePar(o, [0xff, 0xd8, 0xff]) },
  {
    mime: "image/png",
    extensions: ["png"],
    label: "PNG",
    consultable: true,
    signature: (o) => commencePar(o, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    mime: "image/webp",
    extensions: ["webp"],
    label: "WebP",
    consultable: true,
    signature: (o) => commencePar(o, ascii("RIFF")) && commencePar(o, ascii("WEBP"), 8),
  },
  { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extensions: ["xlsx"], label: "Excel", consultable: false, signature: ZIP },
  { mime: "application/vnd.ms-excel", extensions: ["xls"], label: "Excel", consultable: false, signature: OLE },
  { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", extensions: ["docx"], label: "Word", consultable: false, signature: ZIP },
  { mime: "application/msword", extensions: ["doc"], label: "Word", consultable: false, signature: OLE },
  {
    mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    extensions: ["pptx"],
    label: "PowerPoint",
    consultable: false,
    signature: ZIP,
  },
  { mime: "application/vnd.ms-powerpoint", extensions: ["ppt"], label: "PowerPoint", consultable: false, signature: OLE },
  { mime: "application/zip", extensions: ["zip"], label: "ZIP", consultable: false, signature: ZIP },
  { mime: "text/csv", extensions: ["csv"], label: "CSV", consultable: false },
  { mime: "text/plain", extensions: ["txt"], label: "Texte", consultable: false },
];

export const formatParMime = (mime: string) => FORMATS.find((f) => f.mime === mime);

/**
 * Type du fichier d'après son extension, confirmé par ses premiers octets quand le format en a une signature.
 * Un « .pdf » qui n'est pas un PDF, ou une extension inconnue, donne null.
 */
export function formatDe(nom: string, octets: Uint8Array): string | null {
  const point = nom.lastIndexOf(".");
  if (point < 0) return null;
  const extension = nom.slice(point + 1).toLowerCase();
  const format = FORMATS.find((f) => f.extensions.includes(extension));
  if (!format) return null;
  if (format.signature && !format.signature(octets)) return null;
  return format.mime;
}

/** « 84 Ko », « 1,2 Mo » (comme le design). */
export function tailleLisible(octets: number): string {
  if (octets < 1_000_000) return `${Math.max(1, Math.round(octets / 1000))} Ko`;
  return `${(octets / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}
