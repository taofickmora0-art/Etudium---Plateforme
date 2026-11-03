import type { MoyensDePaiement, Operateur, OperateurPaiement } from "@/lib/abonnement/types";
import { nomPays, zeroNational } from "./pays";
import type { PaiementPayiz } from "./payiz";

// Les règles du paiement Mobile Money (lot 2, spec §2 et §6 ; tous pays depuis le 3 novembre 2026) : le numéro,
// l'opérateur proposé, les messages, et la lecture d'un paiement Payiz. Module sans rien du serveur : l'écran s'en sert.

/** Un pays tel que le numéro en a besoin : son code alpha-3 et son indicatif (« +229 »). */
export type PaysTelephone = { code: string; indicatif: string };

/** Un code d'opérateur Payiz tel que la base l'accepte (0072). */
export const codeOperateurValide = (v: unknown): v is Operateur => typeof v === "string" && /^[a-z0-9_-]{1,40}$/.test(v);

/**
 * Le numéro au format international de Payiz (« +2290142000000 »), ou null. Espaces, points, tirets et parenthèses sont
 * ignorés ; l'indicatif du pays (« +229 », « 00229 », « 229 ») aussi ; un autre indicatif est refusé. Au Bénin, la
 * règle d'avant reste : 10 chiffres commençant par « 01 », et les 8 chiffres d'avant 2024 prennent « 01 » devant.
 * Ailleurs, la validité fine reste à Payiz (`phone_invalid`) : seuls la longueur (E.164) et le « 0 » national comptent ici.
 */
export function normaliserTelephone(saisie: string, pays: PaysTelephone): string | null {
  const indicatif = pays.indicatif.replace(/\D/g, "");
  if (!indicatif) return null;
  let chiffres = saisie.replace(/[\s.\-()/]/g, "");
  if (chiffres.startsWith("+")) {
    chiffres = chiffres.slice(1);
    if (!chiffres.startsWith(indicatif)) return null;
    chiffres = chiffres.slice(indicatif.length);
  } else if (chiffres.startsWith("00")) {
    if (!chiffres.startsWith(`00${indicatif}`)) return null;
    chiffres = chiffres.slice(indicatif.length + 2);
  } else if (chiffres.startsWith(indicatif) && chiffres.length - indicatif.length >= 8) {
    // Sans « + » : l'indicatif en tête n'est retiré que s'il reste un numéro entier derrière.
    chiffres = chiffres.slice(indicatif.length);
  }
  if (!/^\d+$/.test(chiffres)) return null;
  if (pays.code === "BEN") {
    if (chiffres.length === 8 && !chiffres.startsWith("0")) chiffres = `01${chiffres}`;
    return /^01\d{8}$/.test(chiffres) ? `+${indicatif}${chiffres}` : null;
  }
  if (zeroNational(pays.code) && chiffres.startsWith("0")) chiffres = chiffres.slice(1);
  return chiffres.length >= 6 && indicatif.length + chiffres.length <= 15 ? `+${indicatif}${chiffres}` : null;
}

/**
 * L'opérateur proposé d'après le numéro normalisé et les préfixes de Payiz : le préfixe le plus long l'emporte ; deux
 * opérateurs à égalité, ou aucun : null (le payeur choisit). Au Bénin, des préfixes sans « 01 » (ancien format) valent
 * aussi après « 01 » ; là où le « 0 » national tombe (Ghana), des préfixes écrits avec ce 0 valent aussi. Payiz déduit aussi l'opérateur du numéro : ceci n'est qu'une proposition.
 */
export function operateurDuNumero(
  telephone: string,
  pays: PaysTelephone & { operateurs: Pick<OperateurPaiement, "code" | "prefixes">[] },
): Operateur | null {
  const indicatif = pays.indicatif.replace(/\D/g, "");
  const chiffres = telephone.replace(/\D/g, "");
  if (!indicatif || !chiffres.startsWith(indicatif)) return null;
  const national = chiffres.slice(indicatif.length);
  const formes = [national];
  if (pays.code === "BEN" && /^01\d{8}$/.test(national)) formes.push(national.slice(2));
  if (zeroNational(pays.code)) formes.push(`0${national}`);
  let meilleur: { code: Operateur; longueur: number } | null = null;
  let egalite = false;
  for (const o of pays.operateurs) {
    for (const prefixe of o.prefixes) {
      if (!prefixe || !formes.some((f) => f.startsWith(prefixe))) continue;
      if (!meilleur || prefixe.length > meilleur.longueur) {
        meilleur = { code: o.code, longueur: prefixe.length };
        egalite = false;
      } else if (prefixe.length === meilleur.longueur && o.code !== meilleur.code) {
        egalite = true;
      }
    }
  }
  return meilleur && !egalite ? meilleur.code : null;
}

/** « +229 •• •• •• •• 00 » : l'indicatif, puis seuls les deux derniers chiffres. */
export function masquerTelephone(telephone: string, indicatif: string): string {
  return `${indicatif} •• •• •• •• ${telephone.replace(/\D/g, "").slice(-2).padStart(2, "•")}`;
}

// Les noms des opérateurs connus, pour les paiements d'avant la 0072 (le code seul) et le repli.
const NOMS_OPERATEURS: Record<string, string> = { mtn: "MTN Mobile Money", moov: "Moov Money", celtiis: "Celtiis Cash" };

/** Le nom d'un opérateur : celui donné par Payiz au paiement, sinon celui d'un code connu, sinon le code mis en forme. */
export function nomOperateur(code: string | null, nom?: string | null): string {
  const donne = nom?.trim();
  if (donne) return donne;
  if (!code) return "Mobile Money";
  const lisible = code.replace(/[_-]+/g, " ").trim();
  return NOMS_OPERATEURS[code] ?? (lisible ? lisible[0].toUpperCase() + lisible.slice(1) : "Mobile Money");
}

// Les préfixes béninois (les deux chiffres après « 01 »), pour le repli seulement.
const PREFIXES_MTN = ["42", "46", "50", "51", "52", "53", "54", "56", "57", "59", "61", "62", "66", "67", "69", "90", "91", "96", "97"];
const PREFIXES_MOOV = ["55", "58", "60", "63", "64", "65", "68", "94", "95", "98", "99"];

const operateurDeRepli = (code: string, prefixes: string[]): OperateurPaiement => ({
  code,
  nom: NOMS_OPERATEURS[code],
  logo: null,
  prefixes: prefixes.map((p) => `01${p}`),
  devise: "XOF",
  montantAPayer: null,
  minimum: null,
  maximum: null,
});

/** Payiz injoignable, ou pas de clé : le Bénin, avec MTN et Moov (ce que proposait Étudium avant le 3 novembre 2026). */
export const MOYENS_REPLI: MoyensDePaiement = {
  repli: true,
  pays: [{ code: "BEN", nom: nomPays("BEN"), indicatif: "+229", operateurs: [operateurDeRepli("mtn", PREFIXES_MTN), operateurDeRepli("moov", PREFIXES_MOOV)] }],
};

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

const OPERATEUR_REQUIS = "Choisissez votre opérateur.";

const MESSAGES_ERREUR: Record<string, string> = {
  operator_required: OPERATEUR_REQUIS,
  phone_invalid: "Ce numéro n’est pas valide pour le pays choisi. Vérifiez-le.",
  country_unavailable: "Le paiement n’est pas proposé dans ce pays pour le moment. Choisissez un autre pays.",
  currency_unavailable: "Ce moyen de paiement n’accepte pas le franc CFA pour le moment. Choisissez un autre opérateur ou un autre pays.",
  exchange_rate_unavailable:
    "La conversion vers la monnaie de votre opérateur est indisponible pour le moment. Réessayez plus tard ou choisissez un autre opérateur.",
  amount_out_of_range: "Ce montant dépasse les limites de cet opérateur. Choisissez un autre opérateur.",
  payment_declined: "Le paiement a été refusé. Essayez un autre numéro ou un autre opérateur.",
  attempt_in_progress: "Une demande est déjà en attente sur votre téléphone. Validez-la ou attendez quelques minutes.",
  operator_unavailable: MESSAGES_ECHEC.operator_unavailable,
  operator_limit: MESSAGES_ECHEC.operator_limit,
  payment_closed: "Cette demande est close. Recommencez le paiement.",
  too_many_attempts: "Trop d’essais sur ce paiement. Recommencez dans quelques minutes.",
};

/** Une erreur de l'API Payiz (`error.code`), en clair ; tout le reste (clé, compte, réseau) : indisponible. */
export const messageErreurPayiz = (code: string): string => MESSAGES_ERREUR[code] ?? "Le paiement est indisponible pour le moment. Réessayez plus tard.";

/** L'erreur Payiz se dit à l'étudiant (numéro, opérateur…) ; sinon elle regarde l'équipe (clé, compte, réseau). */
export const erreurPayizTraduite = (code: string): boolean => code in MESSAGES_ERREUR;

/** Traduites pour l'étudiant, mais signalées aussi à l'équipe : un pays ou une monnaie à ouvrir chez Payiz. */
export const erreurPayizASignaler = (code: string): boolean => ["country_unavailable", "currency_unavailable", "exchange_rate_unavailable"].includes(code);

/** « A », « A ou B », « A, B ou C ». */
const enumeration = (noms: string[]) => (noms.length < 2 ? noms.join("") : `${noms.slice(0, -1).join(", ")} ou ${noms[noms.length - 1]}`);

/** `operator_required` : le numéro ne suffit pas à Payiz ; les opérateurs possibles sont nommés. */
export const messageOperateurRequis = (noms: string[]): string => (noms.length ? `Choisissez votre opérateur : ${enumeration(noms)}.` : OPERATEUR_REQUIS);

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
