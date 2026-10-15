import type { CardTag } from "@/components/ui/CourseCard";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import type { CarteCatalogue, FicheFormation, LeconFiche } from "./types";

// Règles d'affichage du catalogue et de la fiche (spec du lot 1, §2, §3 et §11).

/** « 6 h 20 », « 6 h 00 », « 45 min » (minutes arrondies) ; rien pour une durée nulle. */
export function dureeLisible(secondes: number): string {
  if (secondes <= 0) return "";
  const minutes = Math.max(1, Math.round(secondes / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

/** « 1 leçon », « 12 leçons » (zéro reste au singulier). */
export const nombreDeLecons = (n: number) => `${n} ${n > 1 ? "leçons" : "leçon"}`;

/**
 * Le badge d'une carte, un seul et le même partout (spec §11) : « Gratuit » d'abord, puis le badge saisi au
 * back-office (Populaire, Nouveau), puis « Complémentaire » pour une formation disponible seule.
 */
export function badgeDeCarte(carte: Pick<CarteCatalogue, "gratuite" | "badge" | "achatSepare">): CardTag | undefined {
  if (carte.gratuite) return { tone: "gratuit", label: "Gratuit" };
  if (carte.badge === "populaire") return { tone: "populaire", label: "Populaire" };
  if (carte.badge === "nouveau") return { tone: "nouveau", label: "Nouveau" };
  // Couleurs du catalogue du design : « Complémentaire » en bleu, comme « Nouveau ».
  if (carte.achatSepare) return { tone: "nouveau", label: "Complémentaire" };
  return undefined;
}

/** Couleur de l'illustration : celle du premier parcours (par ordre), académique à défaut. */
export function parcoursPrincipal(carte: Pick<CarteCatalogue, "parcours">): CouleurParcours {
  const premier = [...carte.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  return premier?.couleur ?? "academique";
}

const lecons = (fiche: Pick<FicheFormation, "modules">): LeconFiche[] => fiche.modules.flatMap((m) => m.lecons);

/**
 * Ce que la personne peut suivre (spec §3, lot 1) : toute la formation si elle est gratuite et que la personne a un
 * compte ; sinon ses leçons d'aperçu s'il y en a ; sinon rien. Les abonnements arrivent au lot 2.
 */
export function etatAcces(fiche: Pick<FicheFormation, "gratuite" | "modules">, connecte: boolean): "gratuite" | "apercu" | "verrouillee" {
  if (fiche.gratuite && connecte) return "gratuite";
  return lecons(fiche).some((l) => l.apercu) ? "apercu" : "verrouillee";
}

/** Première leçon que la personne peut ouvrir (règle de la base), dans l'ordre du programme. */
export const premiereLeconOuverte = (fiche: Pick<FicheFormation, "modules">): LeconFiche | null => lecons(fiche).find((l) => l.accessible) ?? null;

/** Leçons d'aperçu, dans l'ordre du programme. */
export const leconsApercu = (fiche: Pick<FicheFormation, "modules">): LeconFiche[] => lecons(fiche).filter((l) => l.apercu);

/** Une leçon de contenu (vidéo, texte) : les quiz et les exercices ne comptent pas dans la progression (R17). */
export const estLeconDeContenu = (l: { type?: string }) => (l.type ?? "lecon") === "lecon";
