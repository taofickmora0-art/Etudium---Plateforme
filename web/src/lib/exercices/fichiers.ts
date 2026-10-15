import { formatDe } from "@/lib/admin/fichiers";

// Les fichiers de rendu (spec du lot 3, choix 7). La même liste est recopiée dans la migration 0032 (types acceptés par
// l'espace « rendus », vérifiés aussi par rendre_exercice) : un test vérifie que les deux restent identiques.

/** 20 Mo. */
export const RENDU_MAX_OCTETS = 20971520;

/** PDF, Word, Excel, PowerPoint, image (JPG, PNG, WebP) ou ZIP. */
export const FORMATS_RENDU = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/zip",
];

/** Pour le sélecteur de fichiers du système. */
export const ACCEPT_RENDU = ".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.xlsx,.xls,.pptx,.ppt,.zip";

/** En clair, sous la zone de dépôt. */
export const LIBELLE_FORMATS_RENDU = "PDF, Word, Excel, PowerPoint, image ou ZIP · 20 Mo maximum";

/** Le type du fichier d'après son extension et ses premiers octets, s'il est accepté pour un rendu ; sinon null. */
export function formatDeRendu(nom: string, octets: Uint8Array): string | null {
  const format = formatDe(nom, octets);
  return format && FORMATS_RENDU.includes(format) ? format : null;
}
