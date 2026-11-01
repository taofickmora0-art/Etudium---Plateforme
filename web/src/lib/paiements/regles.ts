import type { Operateur } from "@/lib/abonnement/types";
import type { PaiementPayiz } from "./payiz";

// Les règles du paiement Mobile Money (lot 2, spec §2 et §6) : le numéro, l'opérateur proposé, les messages, et la
// lecture d'un paiement Payiz.

/**
 * Un numéro béninois au format de Payiz (« +2290142000000 »), ou null. Espaces, points et tirets sont ignorés ; « +229 »,
 * « 00229 » ou « 229 » en tête aussi. Les 8 chiffres d'avant le passage à 10 chiffres (2024), avec ou sans indicatif,
 * prennent « 01 » devant.
 */
export function normaliserTelephone(saisie: string): string | null {
  let chiffres = saisie.replace(/[\s.\-()]/g, "");
  if (chiffres.startsWith("+")) {
    chiffres = chiffres.slice(1);
    if (!chiffres.startsWith("229")) return null;
  }
  if (!/^\d+$/.test(chiffres)) return null;
  for (const prefixe of ["00229", "229"]) {
    const reste = chiffres.length - prefixe.length;
    if (chiffres.startsWith(prefixe) && (reste === 10 || (reste === 8 && chiffres[prefixe.length] !== "0"))) {
      chiffres = chiffres.slice(prefixe.length);
      break;
    }
  }
  if (chiffres.length === 8 && !chiffres.startsWith("0")) chiffres = `01${chiffres}`;
  return /^01\d{8}$/.test(chiffres) ? `+229${chiffres}` : null;
}

// Les préfixes (les deux chiffres après « 01 ») ; Payiz déduit aussi l'opérateur du numéro, ceci n'est qu'une proposition.
const PREFIXES_MTN = ["42", "46", "50", "51", "52", "53", "54", "56", "57", "59", "61", "62", "66", "67", "69", "90", "91", "96", "97"];
const PREFIXES_MOOV = ["55", "58", "60", "63", "64", "65", "68", "94", "95", "98", "99"];

/** L'opérateur proposé d'après le numéro normalisé ; null si on ne sait pas. */
export function operateurDuNumero(telephone: string): Operateur | null {
  const prefixe = /^\+22901(\d{2})/.exec(telephone)?.[1];
  if (!prefixe) return null;
  if (PREFIXES_MTN.includes(prefixe)) return "mtn";
  if (PREFIXES_MOOV.includes(prefixe)) return "moov";
  return null;
}

/** « +229 01 •• •• •• 00 » : seuls les deux derniers chiffres restent. */
export function masquerTelephone(telephone: string): string {
  return `+229 01 •• •• •• ${telephone.replace(/\D/g, "").slice(-2).padStart(2, "•")}`;
}

const MESSAGES_ECHEC: Record<string, string> = {
  insufficient_funds: "Votre solde Mobile Money est insuffisant. Rechargez puis réessayez.",
  payer_declined: "Vous avez refusé la demande sur votre téléphone.",
  timeout: "La demande n’a pas été validée à temps.",
  invalid_phone: "Ce numéro n’est pas reconnu par l’opérateur.",
  operator_limit: "Votre plafond Mobile Money est atteint.",
  operator_unavailable: "L’opérateur ne répond pas pour le moment. Réessayez dans quelques minutes.",
};

/** Le motif d'un essai échoué (`failure_code` de Payiz), en clair. */
export const messageEchec = (motif: string | null): string => (motif && MESSAGES_ECHEC[motif]) || "Le paiement n’a pas abouti.";

const MESSAGES_ERREUR: Record<string, string> = {
  operator_required: "Choisissez votre opérateur, MTN ou Moov.",
  phone_invalid: "Ce numéro n’est pas valide. Vérifiez-le.",
  attempt_in_progress: "Une demande est déjà en attente sur votre téléphone. Validez-la ou attendez quelques minutes.",
  operator_unavailable: MESSAGES_ECHEC.operator_unavailable,
  payment_closed: "Cette demande est close. Recommencez le paiement.",
  too_many_attempts: "Trop d’essais sur ce paiement. Recommencez dans quelques minutes.",
};

/** Une erreur de l'API Payiz (`error.code`), en clair ; tout le reste (clé, compte, réseau) : indisponible. */
export const messageErreurPayiz = (code: string): string => MESSAGES_ERREUR[code] ?? "Le paiement est indisponible pour le moment. Réessayez plus tard.";

export type Verdict =
  | { action: "confirmer"; montant: number }
  | { action: "echec"; statut: "echoue" | "expire" | "annule"; motif: string | null }
  | { action: "attendre" };

/** Ce que dit un paiement Payiz : le confirmer, noter son échec, ou attendre la réponse du payeur. */
export function verdictPayiz(p: PaiementPayiz): Verdict {
  switch (p.status) {
    case "succeeded":
    case "partially_refunded":
      return { action: "confirmer", montant: p.amount };
    // Remboursé en entier avant que nous l'ayons vu réussi : rien à ouvrir. (Déjà réussi chez nous, il ne change pas :
    // l'équipe annule alors l'abonnement au back-office.)
    case "refunded":
      return { action: "echec", statut: "annule", motif: null };
    case "expired":
      return { action: "echec", statut: "expire", motif: null };
    case "canceled":
      return { action: "echec", statut: "annule", motif: null };
    case "requires_payment": {
      const essai = p.latest_attempt;
      if (essai?.status === "failed") return { action: "echec", statut: "echoue", motif: essai.failure_code ?? "unknown" };
      if (essai?.status === "expired") return { action: "echec", statut: "echoue", motif: "timeout" };
      return { action: "attendre" };
    }
    default:
      return { action: "attendre" };
  }
}
