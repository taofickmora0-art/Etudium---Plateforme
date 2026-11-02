import type { Operateur, MoyenManuel, StatutPaiement } from "@/lib/abonnement/types";

// La vue d'ensemble du back-office (design NdAdmin) et les statistiques par période (lot 6 A, spec §4 ; 0062).

export type ElementPaiement = { id: string; nom: string; formule: string; operateur: Operateur | null; moyenManuel: MoyenManuel | null; date: string };
export type FinProche = { profilId: string; nom: string; formule: string; fin: string; jours: number };

/** Les deux indicateurs de plus (0067) : la conversion et les abonnements à renouveler (étudiants seulement). */
export type ComplementsVueEnsemble = {
  conversion: { abonnes: number; inscrits: number; taux: number | null };
  aRenouveler: { total: number; renouveles: number };
};

export type VueEnsemble = {
  utilisateurs: { total: number; ceMois: number };
  abonnes: { actifs: number; moisPrecedent: number };
  revenusMois: number;
  formations: { total: number; brouillons: number };
  certificats: number;
  /** 0 à 100 ; null sans formation commencée. */
  tauxCompletion: number | null;
  abonnementsParMois: { mois: string; nouveaux: number; renouvellements: number }[];
  formules: { code: string; nom: string; part: number }[];
  aTraiter: { aExaminer: number; paiementsEchoues: ElementPaiement[]; paiementsEnAttente: ElementPaiement[]; finsProches: FinProche[] };
  dernieresInscriptions: { id: string; nom: string; creeLe: string; formule: string | null }[];
  derniersPaiements: (ElementPaiement & { dureeMois: number; montant: number; statut: StatutPaiement })[];
  /** null sans la migration 0067 : les six indicateurs du design seulement. */
  complements: ComplementsVueEnsemble | null;
};

export type JoursPeriode = 30 | 90 | 365;
export type OngletStatistiques = "etudiants" | "formations" | "business";

export type StatistiquesFormation = {
  id: string;
  titre: string;
  statut: "publiee" | "desactivee";
  suiveurs: number;
  nouveaux: number;
  progression: number;
  achevement: number;
  secondesVideo: number;
  note: number | null;
  avis: number;
  certificats: number;
};

export type StatistiquesPeriode = {
  etudiants: {
    inscrits: number;
    courbe: { debut: string; nombre: number }[];
    actifs: number;
    leconsTerminees: number;
    formationsTerminees: number;
    quiz: { passes: number; reussis: number };
    exercicesValides: number;
    secondesVideo: number;
  };
  formations: StatistiquesFormation[];
  business: {
    abonnesActifs: number;
    nouveaux: number;
    renouvellements: number;
    revenus: number;
    courbe: { debut: string; montant: number }[];
    /** 0 à 100 ; null sans inscrit sur la période. */
    conversion: number | null;
    formules: { code: string; nom: string; nombre: number }[];
    codesPromo: { utilisations: number; remise: number };
  };
};

export const PERIODES: { value: "30" | "90" | "365"; label: string }[] = [
  { value: "30", label: "30 jours" },
  { value: "90", label: "3 mois" },
  { value: "365", label: "12 mois" },
];
export const ONGLETS: { value: OngletStatistiques; label: string }[] = [
  { value: "etudiants", label: "Étudiants" },
  { value: "formations", label: "Formations" },
  { value: "business", label: "Business" },
];
