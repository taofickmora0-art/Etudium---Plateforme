import type { MoyensDePaiement, OperateurPaiement, PaysPaiement } from "@/lib/abonnement/types";
import { fusionnerMoyens, type MoyensRoutes } from "./aiguillage";
import { configurationPaiement, jetonServeur, type ConfigPaiement, type ConfigSasPay } from "./config";
import { codePaysValide, nomPays } from "./pays";
import { lireMoyensPayiz } from "./payiz";
import { codeOperateurValide, MOYENS_REPLI, nomOperateur } from "./regles";
import { catalogueSasPay } from "./saspay";

// Les moyens de paiement viennent de Payiz (`GET /v1/payment_methods`, demande du 2 novembre 2026) : les pays, leurs
// opérateurs (Celtiis compris quand Payiz le propose) et, pour un montant, ce que le payeur paiera. Sur le serveur
// seulement (la clé secrète). La réponse est gardée 5 minutes en mémoire, par montant et par monnaie : la liste change
// rarement, et la page de souscription la demande à chaque visite. C'est le même cache que celui de `"use cache"` sans
// gestionnaire distant (en mémoire, par instance du serveur) ; il est écrit à la main pour ne garder le repli que 30 s et
// pouvoir être testé sans Next. Payiz muet, ou pas de clé : le Bénin, avec MTN et Moov.
// Depuis le 12 novembre 2026, SasPay comble les pays et les opérateurs que Payiz n'encaisse pas (aiguillage.ts) : sa
// liste ne dépend pas du montant, elle est gardée 1 heure (10 minutes s'il ne répond pas).

const DUREE_MS = 5 * 60 * 1000;
/** Le repli est vite redemandé : Payiz peut répondre de nouveau une minute plus tard. */
const DUREE_REPLI_MS = 30 * 1000;
/** La page n'attend pas Payiz plus de 5 secondes : au-delà, le repli. */
const DELAI_MS = 5000;
/** Assez pour les trois abonnements et quelques codes promo ; au-delà, les plus anciennes lectures sont oubliées. */
const TAILLE_MAX = 50;
const DUREE_SASPAY_MS = 60 * 60 * 1000;
const DUREE_SASPAY_MUET_MS = 10 * 60 * 1000;

type Ligne = Record<string, unknown>;

const objet = (v: unknown): Ligne | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Ligne) : null);
const entierOuNull = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
const majuscules = (v: unknown) => (typeof v === "string" ? v.trim().toUpperCase() : "");

function versOperateur(m: Ligne): OperateurPaiement | null {
  const o = objet(m.operator);
  if (!o || !codeOperateurValide(o.code)) return null;
  const nom = typeof o.name === "string" ? o.name.trim().slice(0, 60) : "";
  const logo = typeof o.logo_url === "string" && /^https:\/\/[^\s"'<>]+$/.test(o.logo_url) ? o.logo_url : null;
  const prefixes = Array.isArray(m.phone_prefixes) ? m.phone_prefixes.filter((p): p is string => typeof p === "string" && /^\d{1,12}$/.test(p)) : [];
  const devise = majuscules(m.currency);
  return {
    code: o.code,
    nom: nomOperateur(o.code, nom),
    logo,
    prefixes,
    devise: /^[A-Z]{3}$/.test(devise) ? devise : "XOF",
    montantAPayer: entierOuNull(m.amount_to_pay),
    minimum: entierOuNull(m.min_amount),
    maximum: entierOuNull(m.max_amount),
  };
}

/**
 * La réponse de `payment_methods` en pays et opérateurs : le Bénin d'abord, puis les autres par leur nom ; ce qui est
 * mal formé est écarté ; un opérateur en double (même code dans un pays) aussi. null si rien n'est utilisable.
 */
export function versMoyensDePaiement(reponse: unknown): MoyensDePaiement | null {
  const donnees = objet(reponse)?.data;
  if (!Array.isArray(donnees)) return null;
  const parPays = new Map<string, PaysPaiement>();
  for (const brut of donnees) {
    const m = objet(brut);
    if (!m) continue;
    const code = majuscules(m.country);
    const indicatif = typeof m.dial_code === "string" ? m.dial_code.trim() : "";
    const operateur = versOperateur(m);
    if (!codePaysValide(code) || !/^\+\d{1,4}$/.test(indicatif) || !operateur) continue;
    let pays = parPays.get(code);
    if (!pays) {
      pays = { code, nom: nomPays(code), indicatif, operateurs: [] };
      parPays.set(code, pays);
    }
    if (!pays.operateurs.some((o) => o.code === operateur.code)) pays.operateurs.push(operateur);
  }
  const pays = [...parPays.values()].sort((a, b) => (a.code === "BEN" ? -1 : b.code === "BEN" ? 1 : a.nom.localeCompare(b.nom, "fr")));
  return pays.length ? { pays, repli: false } : null;
}

type Entree = { expire: number; valeur: Promise<MoyensDePaiement | null> };
const cache = new Map<string, Entree>();
type EntreeSasPay = { expire: number; valeur: Promise<PaysPaiement[] | null> };
const cacheSasPay = new Map<string, EntreeSasPay>();

/** Pour les tests : tout oublier. */
export function viderCacheMoyens(): void {
  cache.clear();
  cacheSasPay.clear();
}

function ranger(cle: string, entree: Entree) {
  const maintenant = Date.now();
  for (const [c, e] of cache) if (e.expire <= maintenant) cache.delete(c);
  while (cache.size >= TAILLE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(cle, entree);
}

/** La liste de Payiz pour ce montant, gardée 5 minutes ; null s'il ne répond pas (ou rien d'utilisable), gardé 30 s. */
function lirePayiz(config: ConfigPaiement, somme: number | null, devise: string, f: typeof fetch): Promise<MoyensDePaiement | null> {
  // La clé compte (une empreinte, jamais la clé) : passer de la clé de test à la réelle change la liste.
  const cle = `${config.jeton.slice(0, 16)}:${devise}:${somme ?? "-"}`;
  const trouvee = cache.get(cle);
  if (trouvee && trouvee.expire > Date.now()) return trouvee.valeur;

  const entree: Entree = { expire: Date.now() + DUREE_MS, valeur: Promise.resolve(null) };
  entree.valeur = lireMoyensPayiz(config.cle, { montant: somme, devise }, f, DELAI_MS)
    .then(versMoyensDePaiement)
    .catch(() => null)
    .then((moyens) => {
      if (!moyens) entree.expire = Date.now() + DUREE_REPLI_MS;
      return moyens;
    });
  ranger(cle, entree);
  return entree.valeur;
}

/** La liste de SasPay, gardée 1 heure ; null s'il ne répond pas, gardé 10 minutes. */
function lireSasPay(config: ConfigSasPay, f: typeof fetch): Promise<PaysPaiement[] | null> {
  const cle = jetonServeur(config.cle).slice(0, 16);
  const trouvee = cacheSasPay.get(cle);
  if (trouvee && trouvee.expire > Date.now()) return trouvee.valeur;
  const entree: EntreeSasPay = { expire: Date.now() + DUREE_SASPAY_MS, valeur: Promise.resolve(null) };
  entree.valeur = catalogueSasPay(config.cle, f)
    .catch(() => null)
    .then((pays) => {
      if (!pays) entree.expire = Date.now() + DUREE_SASPAY_MUET_MS;
      return pays;
    });
  cacheSasPay.set(cle, entree);
  return entree.valeur;
}

/** Le repli (Bénin, MTN, Moov) : chez Payiz. */
const REPLI: MoyensRoutes = { moyens: MOYENS_REPLI, prestataireDe: () => "payiz" };

/**
 * Les moyens de paiement pour ce montant (en unités de la monnaie du paiement, le franc CFA par défaut) et, pour le
 * serveur seulement, qui encaisse chaque opérateur. Ne lève jamais : sans clé, ou si personne ne répond, le repli.
 */
export async function lireMoyensRoutes({ montant, devise = "XOF" }: { montant?: number | null; devise?: string } = {}, f: typeof fetch = fetch): Promise<MoyensRoutes> {
  const config = configurationPaiement();
  if (!config) return REPLI;
  const somme = typeof montant === "number" && Number.isInteger(montant) && montant > 0 ? montant : null;
  const [payiz, saspay] = await Promise.all([lirePayiz(config, somme, devise, f), config.saspay ? lireSasPay(config.saspay, f) : null]);
  return fusionnerMoyens(payiz, saspay, somme) ?? REPLI;
}

/** Les moyens de paiement pour ce montant, tels qu'ils partent au navigateur (sans les prestataires). Ne lève jamais. */
export async function lireMoyensDePaiement(demande: { montant?: number | null; devise?: string } = {}, f: typeof fetch = fetch): Promise<MoyensDePaiement> {
  return (await lireMoyensRoutes(demande, f)).moyens;
}

/** Les moyens pour chacun de ces montants (les prix des abonnements), lus en même temps ; un montant absent est ignoré. */
export async function moyensParMontant(montants: (number | null)[], f: typeof fetch = fetch): Promise<Record<number, MoyensDePaiement>> {
  const uniques = [...new Set(montants.filter((m): m is number => typeof m === "number" && m > 0))];
  const lus = await Promise.all(uniques.map((m) => lireMoyensDePaiement({ montant: m, devise: "XOF" }, f)));
  return Object.fromEntries(uniques.map((m, i) => [m, lus[i]]));
}

/** Le nombre de pays que SasPay encaisse en ce moment, pour le back-office ; null sans SasPay utilisable, ou s'il est muet. */
export async function paysSecours(f: typeof fetch = fetch): Promise<number | null> {
  const config = configurationPaiement();
  if (!config?.saspay) return null;
  return (await lireSasPay(config.saspay, f))?.length ?? null;
}
