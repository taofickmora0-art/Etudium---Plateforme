import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Jetons déclarés dans globals.css : tailwind-merge doit les connaître pour arbitrer les conflits
// (par exemple text-discret = couleur, text-sm = taille).
const COULEURS = [
  "page", "coque", "coque-survol", "panneau", "fond-doux",
  "encre", "titre", "texte", "ardoise", "ardoise-fonce", "discret", "indice", "gris-icone",
  "bordure-carte", "bordure", "bordure-champ", "separateur", "filet", "piste", "inactif",
  "bleu", "bleu-survol", "bleu-nuit", "bleu-clair", "bleu-pale", "bleu-bord", "bleu-moyen",
  "reussite-fond", "reussite-texte", "attention-fond", "attention-texte",
  "erreur-fond", "erreur-texte", "erreur-vif", "erreur-survol", "premium-fond", "premium-texte",
  "business-fond", "business-texte", "business-vif", "business-clair", "business-nuit",
  "digital-fond", "digital-clair", "digital-vif", "digital-fonce", "digital-nuit", "etoile",
];

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: COULEURS,
      radius: ["etiquette", "puce", "champ", "bouton", "carte", "menu", "bloc", "panneau", "coque"],
      shadow: ["menu", "focus", "pastille"],
    },
  },
});

/** Assemble des classes Tailwind ; en cas de conflit, la dernière l'emporte. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
