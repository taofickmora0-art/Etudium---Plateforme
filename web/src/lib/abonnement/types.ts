// Les abonnements et leurs paiements (lot 2, spec du 1er novembre 2026) : les formes que l'appli manipule, lues depuis
// les fonctions de la base (0049) par `conversion.ts`.

export type CodeFormule = "basique" | "standard" | "premium";
/**
 * Le code d'un opérateur chez Payiz (« mtn », « moov », « celtiis »…) : minuscules, chiffres, « _ » et « - », 40
 * caractères au plus (0072). Les paiements d'avant le 3 novembre 2026 n'ont que « mtn » ou « moov ».
 */
export type Operateur = string;
export type StatutPaiement = "en_attente" | "reussi" | "echoue" | "expire" | "annule";
export type DureeMois = 3 | 6 | 12;
/** Un paiement reçu hors plateforme, enregistré à la main au back-office (0054). */
export type MoyenManuel = "mobile_money" | "especes" | "virement" | "offert";

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
  /** Le nom de l'opérateur au moment du paiement (« Celtiis Cash ») ; null avant la 0072 : on le déduit du code. */
  operateurNom: string | null;
  /** Le pays du payeur, ISO 3166 alpha-3 (« BEN ») ; null pour un paiement sans Payiz. */
  pays: string | null;
  /** « +229 •• •• •• •• 00 » (« +229 01 •• •• •• 00 » avant la 0072) : le numéro complet n'est jamais gardé. */
  telephoneMasque: string | null;
  /** Motif Payiz d'un essai échoué (`insufficient_funds`…). */
  motifEchec: string | null;
  numeroRecu: string | null;
  payizId: string | null;
  /** Payé chez Payiz, ou attribué à la main au back-office (0054). */
  source: "payiz" | "manuel";
  moyenManuel: MoyenManuel | null;
  referenceManuelle: string | null;
  creeLe: string;
  essaiLe: string | null;
  confirmeLe: string | null;
  abonnement: { debut: string; fin: string } | null;
  /** Le paiement en cours, repris au lieu d'en créer un second (choix 3 de la spec). */
  repris?: boolean;
};

/** Un opérateur de Mobile Money proposé par Payiz dans un pays (`GET /v1/payment_methods`). */
export type OperateurPaiement = {
  /** Le code à renvoyer à Payiz (`operator`). */
  code: Operateur;
  nom: string;
  /** Le logo servi par Payiz (https seulement). */
  logo: string | null;
  /** Les premiers chiffres de ses numéros, sans l'indicatif ; vide : Payiz ne reconnaît pas ses numéros. */
  prefixes: string[];
  /** La monnaie dans laquelle le payeur paie (« XOF », « GHS »…). */
  devise: string;
  /** Ce que le payeur paiera, dans sa monnaie, frais compris s'il les porte ; null si Payiz ne l'a pas dit. */
  montantAPayer: number | null;
  minimum: number | null;
  maximum: number | null;
  /**
   * Comment l'opérateur fait valider (absent : sur le téléphone) : « page », sur sa propre page (Wave, Orange Money),
   * où l'étudiant est envoyé ; « code », avec un code de paiement que l'étudiant génère d'avance (Orange Côte d'Ivoire).
   */
  validation?: "page" | "code";
  /** Pour « code » : ce qu'il faut composer pour obtenir le code (« Composez #144*82#… »). */
  consigne?: string | null;
};

/** Un pays où l'on peut payer : son code ISO 3166 alpha-3, son nom en français, son indicatif (« +229 »). */
export type PaysPaiement = { code: string; nom: string; indicatif: string; operateurs: OperateurPaiement[] };

/**
 * Les moyens de paiement de Payiz, pour un montant ; `repli` : Payiz n'a pas répondu (ou pas de clé), seuls MTN et Moov
 * au Bénin sont proposés.
 */
export type MoyensDePaiement = { pays: PaysPaiement[]; repli: boolean };

export type EssaiCode =
  | { ok: true; prixInitial: number; remise: number; montant: number; /** Les moyens de paiement pour le montant après remise. */ moyens?: MoyensDePaiement }
  | {
      ok: false;
      message: string;
      /** Refusé pour cet abonnement seulement (0073) : il peut valoir pour un autre, l'écran le réessaie au changement. */
      autreAbonnement?: true;
    };

/** Où en est un paiement, pour l'écran de souscription. */
export type EtapePaiement =
  | { etat: "attente"; paiement: CartePaiement; finAttente: string; /** Wave, Orange Money : la page de l'opérateur, où valider. */ redirection?: string }
  | { etat: "reussi"; paiement: CartePaiement }
  | { etat: "echoue"; paiement: CartePaiement; message: string; /** L'écran a cessé d'attendre ; l'état chez Payiz est inconnu. */ incertain?: boolean }
  | { etat: "expire"; paiement: CartePaiement }
  | { etat: "erreur"; message: string; /** `operator_required` : les codes des opérateurs possibles pour ce numéro. */ candidats?: string[] };
