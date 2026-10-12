import { squareCrop } from "./photo";

/**
 * Réduit la photo dans le navigateur avant l'envoi : carré centré de 512 px au plus, en JPEG (environ 80 Ko au lieu de
 * plusieurs Mo pour une photo de téléphone). Si le navigateur ne sait pas lire l'image, on rend le fichier d'origine :
 * le serveur le contrôlera (format, 2 Mo).
 */
export async function resizePhoto(file: File): Promise<File> {
  try {
    // Les photos de téléphone portent leur sens dans l'EXIF : on le respecte, pour ne pas les envoyer couchées.
    const image = await createImageBitmap(file, { imageOrientation: "from-image" });
    const { sx, sy, side, size } = squareCrop(image.width, image.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const contexte = canvas.getContext("2d");
    if (!contexte) return file;
    // Fond blanc : un PNG transparent ne devient pas noir en JPEG.
    contexte.fillStyle = "#ffffff";
    contexte.fillRect(0, 0, size, size);
    contexte.drawImage(image, sx, sy, side, side, 0, 0, size, size);
    image.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}
