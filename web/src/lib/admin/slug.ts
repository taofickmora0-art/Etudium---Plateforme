/** Longueur maximale d'une adresse, coupée sur un tiret. */
const LONGUEUR_MAX = 80;

/**
 * Adresse d'un parcours ou d'une formation tirée de son titre (spec du lot 1, §2) : minuscules sans accents, chiffres et
 * tirets, jamais de point. « Maîtriser Microsoft Excel » → « maitriser-microsoft-excel ». Rend "" s'il ne reste rien.
 */
export function slugify(titre: string): string {
  const base = titre
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (base.length <= LONGUEUR_MAX) return base;
  const coupee = base.slice(0, LONGUEUR_MAX);
  const dernierTiret = coupee.lastIndexOf("-");
  return (dernierTiret > 0 ? coupee.slice(0, dernierTiret) : coupee).replace(/-+$/, "");
}
