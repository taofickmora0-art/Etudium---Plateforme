import QRCode from "qrcode";

/**
 * La matrice du QR Code d'un texte (adresse de vérification) : vrai = case noire. Correction M (15 % de la surface
 * peut être abîmée), comme les QR Codes imprimés courants.
 */
export function matriceQr(texte: string): boolean[][] {
  const { modules } = QRCode.create(texte, { errorCorrectionLevel: "M" });
  return Array.from({ length: modules.size }, (_, ligne) => Array.from({ length: modules.size }, (_, colonne) => Boolean(modules.get(ligne, colonne))));
}
