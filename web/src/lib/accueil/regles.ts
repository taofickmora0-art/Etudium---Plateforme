import { dureeLisible, parcoursPrincipal } from "@/lib/catalogue/regles";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import type { CouleurParcours } from "@/lib/contenus/libelles";
import { urlCouverture } from "@/lib/couvertures/adresse";
import type { FormationSuivie } from "@/lib/mes-formations/regles";
import { recommandations } from "@/lib/recherche/regles";

// Tableau de bord, version de base (spec du lot 1, §8) : seulement les blocs qui ont de vraies données au lot 1.

/** « Continuer l’apprentissage » : la formation en cours la plus récente, sur sa leçon à reprendre. */
export type Reprise = {
  formationId: string;
  titre: string;
  parcours: CouleurParcours;
  /** Parcours principal (« Académique »), absent pour une formation hors parcours. */
  etiquette: { tone: CouleurParcours; libelle: string } | null;
  /** « Voir le parcours » : Mes parcours, ouvert sur ce parcours ; absent hors parcours. */
  lienParcours: string | null;
  /** « Module 3 · Les tableaux croisés dynamiques · 12 min ». */
  sousTitre: string;
  pourcentage: number;
  temps: string;
  href: string;
  /** Adresse de l'image de couverture ; null : couverture par défaut du parcours. */
  couverture: string | null;
};

/** Une ligne de « À faire » : la leçon suivante d'une autre formation en cours (quiz et exercices au lot 3). */
export type ElementAFaire = { id: string; titre: string; sousTitre: string; href: string };

export type TableauDeBord = {
  commencees: number;
  enCours: number;
  /** Moyenne arrondie des pourcentages de toutes les formations commencées, en %. */
  progressionGlobale: number;
  reprise: Reprise | null;
  aFaire: ElementAFaire[];
  /** Formations non commencées des mêmes parcours, complétées par les populaires (3 au plus). */
  recommandees: CarteCatalogue[];
  /** Pour un compte qui n'a rien commencé : des formations gratuites (3 au plus). */
  gratuites: CarteCatalogue[];
};

const AFAIRE_MAX = 5;
const CARTES_MAX = 3;

const parOrdre = <T extends { ordre: number }>(liste: T[]) => [...liste].sort((a, b) => a.ordre - b.ordre);

function reprise(suivie: FormationSuivie): Reprise | null {
  const lecon = suivie.progression.aReprendre;
  if (!lecon || !suivie.href) return null;
  const { fiche } = suivie;
  const numero = fiche.modules.findIndex((m) => m.lecons.some((l) => l.id === lecon.id)) + 1;
  const duree = dureeLisible(lecon.dureeSecondes);
  const principal = parOrdre(fiche.parcours)[0];
  return {
    formationId: fiche.id,
    titre: fiche.titre,
    parcours: parcoursPrincipal(fiche),
    etiquette: principal ? { tone: principal.couleur, libelle: principal.nomCourt } : null,
    lienParcours: principal ? `/parcours?parcours=${principal.slug}` : null,
    sousTitre: [`Module ${numero}`, lecon.titre, duree].filter(Boolean).join(" · "),
    pourcentage: suivie.progression.pourcentage,
    temps: suivie.temps,
    href: suivie.href,
    couverture: urlCouverture(fiche.couverture),
  };
}

/**
 * Recommandé pour vous : les formations non commencées des parcours suivis (parcours de la formation la plus récemment
 * visitée d'abord, puis ordre de la formation dans le parcours), complétées par les populaires, nouvelles et gratuites.
 */
function recommandees(cartes: CarteCatalogue[], suivies: FormationSuivie[]): CarteCatalogue[] {
  const commencees = new Set(suivies.map((s) => s.fiche.id));
  const parcours = [...new Set(suivies.flatMap((s) => parOrdre(s.fiche.parcours).map((p) => p.slug)))];
  const libres = cartes.filter((c) => !commencees.has(c.id));
  const duParcours = parcours.flatMap((slug) =>
    libres
      .flatMap((c) => c.parcours.filter((p) => p.slug === slug).map((p) => ({ carte: c, position: p.position })))
      .sort((a, b) => a.position - b.position)
      .map(({ carte }) => carte),
  );
  const choisies = [...new Map([...duParcours, ...recommandations(cartes, commencees, cartes.length)].map((c) => [c.id, c])).values()];
  return choisies.slice(0, CARTES_MAX);
}

/** Le tableau de bord d'un compte, d'après ses formations suivies (triées par dernière visite) et le catalogue publié. */
export function tableauDeBord(suivies: FormationSuivie[], cartes: CarteCatalogue[]): TableauDeBord {
  const enCours = suivies.filter((s) => s.etat === "enCours");
  const [premiere, ...autres] = enCours.map((s) => ({ suivie: s, reprise: reprise(s) })).filter((r) => r.reprise !== null);
  const total = suivies.reduce((somme, s) => somme + s.progression.pourcentage, 0);
  return {
    commencees: suivies.length,
    enCours: enCours.length,
    progressionGlobale: suivies.length > 0 ? Math.round(total / suivies.length) : 0,
    reprise: premiere?.reprise ?? null,
    aFaire: autres.slice(0, AFAIRE_MAX).map(({ suivie }) => ({
      id: suivie.fiche.id,
      titre: "Leçon suivante",
      sousTitre: `${suivie.fiche.titre} · ${suivie.progression.aReprendre!.titre}`,
      href: suivie.href!,
    })),
    recommandees: suivies.length > 0 ? recommandees(cartes, suivies) : [],
    gratuites: suivies.length > 0 ? [] : recommandations(cartes.filter((c) => c.gratuite), new Set(), CARTES_MAX),
  };
}
