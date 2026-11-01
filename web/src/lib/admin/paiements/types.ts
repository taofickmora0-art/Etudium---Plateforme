import type { CartePaiement, CodeFormule, DureeMois, EtatAbonnement, MoyenManuel, Operateur, StatutPaiement } from "@/lib/abonnement/types";

// Les formes du back-office « Abonnements et paiements », sans rien du serveur : les composants clients les importent.

export type ResumePaiements = { revenusMois: number; reussisMois: number; echouesMois: number; abonnesActifs: number };
export type CodePromo = {
  id: string;
  code: string;
  type: "pourcentage" | "montant";
  valeur: number;
  debut: string | null;
  fin: string | null;
  limite: number | null;
  actif: boolean;
  utilisations: number;
  creeLe: string;
};
export type ComptePaiement = { id: string | null; prenom: string; nom: string; email: string };
export type LignePaiement = {
  id: string;
  creeLe: string;
  compte: ComptePaiement;
  formule: { code: CodeFormule; nom: string; dureeMois: DureeMois };
  montant: number;
  statut: StatutPaiement;
  operateur: Operateur | null;
  telephoneMasque: string | null;
  numeroRecu: string | null;
  source: "payiz" | "manuel";
  moyenManuel: MoyenManuel | null;
};
export type PagePaiements = { total: number; lignes: LignePaiement[] };
export type DetailPaiement = CartePaiement & {
  compte: ComptePaiement | null;
  abonnementEquipe: { id: string; debut: string; fin: string; annuleLe: string | null; motifAnnulation: string | null } | null;
};
/** « Paiements activés » : empreinte posée en base, jeton du serveur reconnu, clé Payiz de test ou réelle. */
export type EtatReglage = { ouverts: boolean; jeton: "reconnu" | "non_reconnu" | "absent"; cle: "test" | "reel" | "absente"; webhook: boolean };

export const PAIEMENTS_PAR_PAGE = 20;

/** La section « Abonnement » de la fiche d'un compte (0054) : son état et ses abonnements, du plus récent au plus ancien. */
export type AbonnementCompte = {
  id: string;
  formule: { code: CodeFormule; nom: string; dureeMois: DureeMois };
  debut: string;
  fin: string;
  annuleLe: string | null;
  motifAnnulation: string | null;
  source: "payiz" | "manuel";
  moyenManuel: MoyenManuel | null;
  operateur: Operateur | null;
  montant: number;
  numeroRecu: string | null;
};
export type AbonnementsCompte = { etat: EtatAbonnement; abonnements: AbonnementCompte[] };
