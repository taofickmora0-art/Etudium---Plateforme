import type { CarteCatalogue, ParcoursCatalogue } from "@/lib/catalogue/types";
import type { ProgressionJeu } from "@/lib/engagement/types";
import type { ProchaineSession } from "@/lib/sessions/types";

// Le tableau de bord de l'étudiant (lot 6 B, spec §1 ; design NdAccueil).

export type TypeActivite = "exercice" | "quiz" | "certificat" | "badge";
export type MotifRecommandation = "suite" | "monetisation" | "parcours" | "catalogue";

/** Ce que rend mon_tableau_de_bord() (0063), converti. */
export type BaseTableau = {
  certificats: { nombre: number; titres: string[] };
  aFaire: { type: "exercice" | "quiz"; formation: string; slug: string; leconId: string; lecon: string }[];
  /** `titre` : la leçon, la formation du certificat, ou le code du badge. */
  activite: { type: TypeActivite; titre: string; formation: string | null; score: number | null; quand: string }[];
  jeu: ProgressionJeu;
  recommandations: { id: string; slug: string; titre: string; motif: MotifRecommandation; message: string | null }[];
};

export type Indicateurs = {
  /** Leçons terminées sur le total des leçons des formations commencées, en %. */
  progression: number;
  /** La part terminée ce mois-ci (heure du Bénin), en points de % : « +12 % ce mois ». */
  progressionMois: number;
  enCours: number;
  commencees: number;
};

/** « Continuer l’apprentissage » : la formation en cours ouverte le plus récemment. */
export type AContinuer = {
  titre: string;
  parcours: ParcoursCatalogue | null;
  /** « Module 3 · Les tableaux croisés dynamiques · 12 min ». */
  lecon: string;
  pourcentage: number;
  /** « 2 h restantes ». */
  temps: string;
  /** La leçon où reprendre. */
  href: string;
  /** La page de la formation (« Voir le parcours »). */
  hrefFormation: string;
};

/** Une ligne de « À faire ». */
export type ElementAFaire = { type: "exercice" | "quiz" | "lecon"; titre: string; detail: string; href: string; etiquette?: string };

export type DonneesTableau = {
  prenom: string;
  indicateurs: Indicateurs;
  continuer: AContinuer | null;
  aFaire: ElementAFaire[];
  /** null : la migration 0063 n'est pas encore appliquée (la page le dit). */
  base: BaseTableau | null;
  /** null : aucune session à venir ; undefined : la migration des sessions manque. */
  session: ProchaineSession | null | undefined;
  /** Les cartes des recommandations, dans l'ordre de la base ; le catalogue si elle n'en rend pas. */
  recommandees: CarteCatalogue[];
  /** « Vous avez terminé « X ». Découvrez maintenant « Y ». », s'il y en a un. */
  messageSuite: string | null;
  maintenant: string;
};
