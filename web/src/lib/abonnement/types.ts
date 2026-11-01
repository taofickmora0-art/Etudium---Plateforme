// Les abonnements et leurs paiements (lot 2, spec du 1er novembre 2026) : les formes que l'appli manipule, lues depuis
// les fonctions de la base (0049) par `conversion.ts`.

export type CodeFormule = "basique" | "standard" | "premium";
export type Operateur = "mtn" | "moov";
export type StatutPaiement = "en_attente" | "reussi" | "echoue" | "expire" | "annule";
export type DureeMois = 3 | 6 | 12;

/** Basique (3 mois), Standard (6 mois), Premium (1 an) ; sans prix tant que l'équipe ne l'a pas fixé. */
export type Formule = { id: string; code: CodeFormule; nom: string; dureeMois: DureeMois; prix: number | null; recommandee: boolean; active: boolean };

/** L'état du compte, calculé à la date du jour : `fin` est la fin réelle de l'accès (abonnements enchaînés compris). */
export type EtatAbonnement = { etat: "gratuit" } | { etat: "actif" | "expire"; formule: { code: CodeFormule; nom: string }; fin: string };

export type CartePaiement = {
  id: string;
  statut: StatutPaiement;
  formule: { code: CodeFormule; nom: string; dureeMois: DureeMois };
  prixInitial: number;
  remise: number;
  montant: number;
  code: string | null;
  operateur: Operateur | null;
  /** « +229 01 •• •• •• 00 » : le numéro complet n'est jamais gardé. */
  telephoneMasque: string | null;
  /** Motif Payiz d'un essai échoué (`insufficient_funds`…). */
  motifEchec: string | null;
  numeroRecu: string | null;
  payizId: string | null;
  creeLe: string;
  essaiLe: string | null;
  confirmeLe: string | null;
  abonnement: { debut: string; fin: string } | null;
  /** Le paiement en cours, repris au lieu d'en créer un second (choix 3 de la spec). */
  repris?: boolean;
};

export type EssaiCode = { ok: true; prixInitial: number; remise: number; montant: number } | { ok: false; message: string };

/** Où en est un paiement, pour l'écran de souscription. */
export type EtapePaiement =
  | { etat: "attente"; paiement: CartePaiement; finAttente: string }
  | { etat: "reussi"; paiement: CartePaiement }
  | { etat: "echoue"; paiement: CartePaiement; message: string; /** L'écran a cessé d'attendre ; l'état chez Payiz est inconnu. */ incertain?: boolean }
  | { etat: "expire"; paiement: CartePaiement }
  | { etat: "erreur"; message: string };
