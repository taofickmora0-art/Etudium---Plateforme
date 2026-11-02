import { LIBELLES_STATUT, type StatutRendu } from "@/lib/exercices/types";
import type { CardTag } from "@/components/ui/CourseCard";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import type { CarteCatalogue, EtatsCartes, FicheFormation, LeconFiche } from "./types";

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

/** « 1 module », « 4 modules » (zéro reste au singulier). */
export const nombreDeModules = (n: number) => `${n} ${n > 1 ? "modules" : "module"}`;

/** « 1 apprenant », « 1 234 apprenants » (zéro reste au singulier). */
export const nombreDApprenants = (n: number) => `${n.toLocaleString("fr-FR")} ${n > 1 ? "apprenants" : "apprenant"}`;

/** La ligne du programme d'une carte : « 4 modules • 12 leçons » ; les leçons seules si les modules n'ont pas été lus. */
export const programmeDeCarte = (carte: Pick<CarteCatalogue, "nbModules" | "nbLecons">) =>
  carte.nbModules === undefined ? nombreDeLecons(carte.nbLecons) : `${nombreDeModules(carte.nbModules)} • ${nombreDeLecons(carte.nbLecons)}`;

/**
 * Le bouton du bas d'une carte du catalogue (spec du 2 novembre 2026, §4 et §9.3) : « 40 % terminé » pour un inscrit,
 * même à 0 % ; sinon « Voir le cours ». Le nombre et « % » restent sur la même ligne (espace insécable).
 */
export const actionDeCarte = (pourcentage: number | undefined) => (pourcentage === undefined ? "Voir le cours" : `${Math.round(pourcentage)}\u00a0% terminé`);

/**
 * Ce que le compte ajoute à la carte d'une formation : son nombre d'apprenants (absent sans la 0069), le pourcentage s'il
 * y est inscrit, et son cœur (absent pour un visiteur).
 */
export function etatDeCarte(etats: EtatsCartes | undefined, formationId: string): { apprenants?: number; progression?: number; favori?: boolean } {
  return {
    apprenants: etats?.apprenants?.[formationId],
    progression: etats?.inscrites[formationId],
    favori: etats?.favoris ? etats.favoris.includes(formationId) : undefined,
  };
}

/** « 4 quiz » ; rien sans quiz (lot 3). */
export const nombreDeQuiz = (n: number | undefined) => (n ? `${n} quiz` : "");

/** Un quiz dans le programme : « Quiz », ou « Quiz · 75 % » avec le meilleur score du compte (lot 3). */
export const libelleQuiz = (meilleur?: number) => (meilleur === undefined ? "Quiz" : `Quiz · ${meilleur} %`);

/** « 3 exercices » ; rien sans exercice (lot 3). */
export const nombreDExercices = (n: number | undefined) => (n ? `${n} ${n > 1 ? "exercices" : "exercice"}` : "");

/** Un exercice dans le programme : « Exercice », ou « Exercice · Validé » avec le dernier statut du compte (lot 3). */
export const libelleExercice = (statut?: StatutRendu) => (statut ? `Exercice · ${LIBELLES_STATUT[statut]}` : "Exercice");

/**
 * Le badge d'une carte, un seul et le même partout (spec §11) : « Gratuit » d'abord, puis le badge saisi au
 * back-office (Populaire, Nouveau). Plus de « Complémentaire » : aucune formation ne s'achète seule (restructuration, §5.2).
 */
export function badgeDeCarte(carte: Pick<CarteCatalogue, "gratuite" | "badge">): CardTag | undefined {
  if (carte.gratuite) return { tone: "gratuit", label: "Gratuit" };
  if (carte.badge === "populaire") return { tone: "populaire", label: "Populaire" };
  if (carte.badge === "nouveau") return { tone: "nouveau", label: "Nouveau" };
  return undefined;
}

/** Couleur de l'illustration : celle du premier parcours (par ordre), académique à défaut. */
export function parcoursPrincipal(carte: Pick<CarteCatalogue, "parcours">): CouleurParcours {
  const premier = [...carte.parcours].sort((a, b) => a.ordre - b.ordre)[0];
  return premier?.couleur ?? "academique";
}

const lecons = (fiche: Pick<FicheFormation, "modules">): LeconFiche[] => fiche.modules.flatMap((m) => m.lecons);

/**
 * Ce que la personne peut suivre (spec §3, lot 1 ; lot 2) : toute la formation si elle est gratuite et que la personne a
 * un compte ; toute la formation payante si la base l'a ouverte (abonnement : une leçon hors aperçu accessible) ; sinon
 * ses leçons d'aperçu s'il y en a ; sinon rien.
 */
export function etatAcces(fiche: Pick<FicheFormation, "gratuite" | "modules">, connecte: boolean): "gratuite" | "incluse" | "apercu" | "verrouillee" {
  if (fiche.gratuite && connecte) return "gratuite";
  if (connecte && lecons(fiche).some((l) => l.accessible && !l.apercu)) return "incluse";
  return leconsApercu(fiche).length > 0 ? "apercu" : "verrouillee";
}

/** Première leçon que la personne peut ouvrir (règle de la base), dans l'ordre du programme. */
export const premiereLeconOuverte = (fiche: Pick<FicheFormation, "modules">): LeconFiche | null => lecons(fiche).find((l) => l.accessible) ?? null;

/**
 * Leçons d'aperçu, dans l'ordre du programme. L'aperçu concerne les leçons de contenu : un quiz ou un exercice resté
 * coché (avant que la case disparaisse de leur éditeur) n'en est pas un.
 */
export const leconsApercu = (fiche: Pick<FicheFormation, "modules">): LeconFiche[] => lecons(fiche).filter((l) => l.apercu && estLeconDeContenu(l));

/** Une leçon de contenu (vidéo, texte) : les quiz et les exercices ne comptent pas dans la progression (R17). */
export const estLeconDeContenu = (l: { type?: string }) => (l.type ?? "lecon") === "lecon";
