// Coller dans l'éditeur riche (fin du lot 4, relecture finale) : Excel et Word mettent une image des cellules à côté du
// tableau copié. Quand le presse-papiers porte du texte (ou un tableau en HTML), c'est lui qui entre ; seule une image
// sans texte (une capture d'écran) part dans l'espace des images.

type PressePapiers = { files: ArrayLike<File> | Iterable<File>; getData: (type: string) => string };

/** Les images à envoyer pour ce collage ; aucune quand du texte l'accompagne. */
export function imagesAColler(presse: PressePapiers | null | undefined): File[] {
  if (!presse) return [];
  const images = Array.from(presse.files as ArrayLike<File>).filter((f) => f.type.startsWith("image/"));
  if (images.length === 0) return [];
  const texte = presse.getData("text/plain").trim();
  // Le HTML d'une image seule (« <meta …><img …> ») ne compte pas comme du texte.
  const html = presse.getData("text/html").replace(/<meta[^>]*>|<img[^>]*>|<\/?(html|head|body)[^>]*>|<!--[\s\S]*?-->/gi, "").trim();
  return texte || html ? [] : images;
}
