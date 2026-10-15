import { LOGO_COMPLET, SYMBOLE } from "./traces";

const BLEU = "#0B18C9";
const BLANC = "#FFFFFF";

/**
 * Symbole Étudium : le « e » coiffé d'un chapeau de diplômé (logo fourni le 15 octobre 2026), dans un carré de `size`.
 * Bleu ; `inverse` : blanc, sur fond bleu.
 */
export function LogoMark({ size = 30, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox={`0 0 ${SYMBOLE.largeur} ${SYMBOLE.hauteur}`} aria-hidden="true" className="block flex-none">
      <path d={SYMBOLE.d} fill={inverse ? BLANC : BLEU} fillRule="evenodd" />
    </svg>
  );
}

/** Logo complet (le symbole suivi de « tudium »), haut de `hauteur` ; décoratif : le lien ou le texte qui l'entoure le nomme. */
export function LogoComplet({ hauteur = 28, inverse = false, className }: { hauteur?: number; inverse?: boolean; className?: string }) {
  const largeur = Math.round(((hauteur * LOGO_COMPLET.largeur) / LOGO_COMPLET.hauteur) * 10) / 10;
  return (
    <svg
      width={largeur}
      height={hauteur}
      viewBox={`0 0 ${LOGO_COMPLET.largeur} ${LOGO_COMPLET.hauteur}`}
      aria-hidden="true"
      className={className ?? "block flex-none"}
    >
      <path d={LOGO_COMPLET.d} fill={inverse ? BLANC : BLEU} fillRule="evenodd" />
    </svg>
  );
}

/** Logo Étudium seul sur la page (page introuvable, état de l'application) : annoncé « Étudium ». */
export function Logo({ hauteur = 30, inverse = false, className = "" }: { hauteur?: number; inverse?: boolean; className?: string }) {
  return (
    <span role="img" aria-label="Étudium" className={`inline-flex items-center ${className}`}>
      <LogoComplet hauteur={hauteur} inverse={inverse} />
    </span>
  );
}
