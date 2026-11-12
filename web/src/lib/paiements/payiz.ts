import { dureeAbonnement } from "@/lib/abonnement/regles";
import type { CodeFormule, Operateur } from "@/lib/abonnement/types";

// Le client de l'API Payiz (https://docs.payiz.app, étudiée le 1er novembre 2026, relue le 2 novembre pour les pays et
// les opérateurs), sur le serveur seulement : la clé secrète ne quitte jamais le serveur. Paiement direct : le paiement
// est créé et la demande envoyée au téléphone en un appel. `fetch` est injectable pour les tests.

export const API_PAYIZ = "https://api.payiz.app/v1";
const DELAI_MS = 15_000;
/** Une demande non réglée expire au bout de 15 minutes. */
const EXPIRATION_S = 15 * 60;

export type EssaiPayiz = {
  id: string;
  status: "pending" | "succeeded" | "failed" | "expired";
  failure_code: string | null;
  operator: string | null;
  phone: string | null;
  /** Le pays du payeur (ISO 3166 alpha-3). */
  country?: string | null;
};

export type PaiementPayiz = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  reference: string | null;
  metadata?: Record<string, string>;
  expires_at: number | null;
  latest_attempt: EssaiPayiz | null;
};

/** Une erreur de l'API (`error.code` : `operator_required`…) ; `reseau` (statut 0) si Payiz est injoignable. */
export class ErreurPayiz extends Error {
  code: string;
  statut: number;
  details?: Record<string, unknown>;

  constructor(code: string, statut: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ErreurPayiz";
    this.code = code;
    this.statut = statut;
    this.details = details;
  }
}

type Requete = { methode: "GET" | "POST"; corps?: unknown; idempotence?: string; delaiMs?: number };

async function appeler<T>(cle: string, chemin: string, { methode, corps, idempotence, delaiMs = DELAI_MS }: Requete, f: typeof fetch): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${cle}` };
  if (corps !== undefined) headers["Content-Type"] = "application/json";
  if (idempotence) headers["Idempotency-Key"] = idempotence;
  let reponse: Response;
  try {
    reponse = await f(`${API_PAYIZ}${chemin}`, {
      method: methode,
      headers,
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(delaiMs),
      cache: "no-store",
    });
  } catch {
    throw new ErreurPayiz("reseau", 0, "Payiz est injoignable.");
  }
  const texte = await reponse.text();
  let donnees: unknown = null;
  try {
    donnees = texte ? JSON.parse(texte) : null;
  } catch {
    donnees = null;
  }
  if (!reponse.ok) {
    const e = (donnees as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null)?.error;
    throw new ErreurPayiz(e?.code ?? "inconnue", reponse.status, e?.message ?? `Payiz a répondu ${reponse.status}.`, e?.details);
  }
  return donnees as T;
}

export type DemandePaiement = {
  /** L'identifiant du paiement chez nous : référence et clé d'idempotence (un double clic ne paie pas deux fois). */
  paiementId: string;
  /** Une autre clé d'idempotence (un nouveau paiement Payiz pour le même paiement, après un échec chez SasPay). */
  cleIdempotence?: string;
  montant: number;
  formule: { code: CodeFormule; nom: string; dureeMois: number };
  /** Normalisé : « +2290142000000 ». */
  telephone: string;
  /** Le pays du payeur, ISO 3166 alpha-3 (« BEN »). */
  pays: string;
  /** Le code de l'opérateur choisi ; null : Payiz le déduit du numéro (ou répond `operator_required`). */
  operateur: Operateur | null;
};

/** Le payeur tel que Payiz l'attend : le numéro international, le pays, et l'opérateur s'il est connu. */
const payeur = (telephone: string, pays: string, operateur: Operateur | null) =>
  operateur ? { phone: telephone, country: pays, operator: operateur } : { phone: telephone, country: pays };

/** Crée le paiement et envoie la demande au téléphone ; frais à la charge d'Étudium. */
export function creerPaiementPayiz(cle: string, d: DemandePaiement, f: typeof fetch = fetch): Promise<PaiementPayiz> {
  return appeler<PaiementPayiz>(
    cle,
    "/payments",
    {
      methode: "POST",
      idempotence: d.cleIdempotence ?? d.paiementId,
      corps: {
        amount: d.montant,
        currency: "XOF",
        reference: d.paiementId,
        description: `Abonnement Étudium ${d.formule.nom} (${dureeAbonnement(d.formule.dureeMois)})`,
        metadata: { formule: d.formule.code },
        fees_paid_by: "merchant",
        expires_at: Math.floor(Date.now() / 1000) + EXPIRATION_S,
        payer: payeur(d.telephone, d.pays, d.operateur),
      },
    },
    f,
  );
}

/**
 * Un nouvel essai sur le même paiement (même numéro ou un autre, d'un autre pays aussi) ; Payiz refuse s'il y en a déjà
 * un en cours. Rend l'essai : l'opérateur que Payiz a retenu.
 */
export function relancerPaiementPayiz(
  cle: string,
  payizId: string,
  e: { telephone: string; pays: string; operateur: Operateur | null; cleIdempotence: string },
  f: typeof fetch = fetch,
): Promise<EssaiPayiz | null> {
  return appeler<EssaiPayiz | null>(
    cle,
    `/payments/${encodeURIComponent(payizId)}/attempts`,
    { methode: "POST", idempotence: e.cleIdempotence, corps: payeur(e.telephone, e.pays, e.operateur) },
    f,
  );
}

/**
 * Les pays et les opérateurs où l'on peut payer (`GET /v1/payment_methods`) ; avec un montant, chaque moyen dit aussi
 * ce que le payeur paiera. La réponse brute : `moyens.ts` la lit et la garde quelques minutes.
 */
export function lireMoyensPayiz(
  cle: string,
  { montant, devise }: { montant?: number | null; devise?: string },
  f: typeof fetch = fetch,
  delaiMs = DELAI_MS,
): Promise<unknown> {
  const parametres = new URLSearchParams();
  if (montant) parametres.set("amount", String(montant));
  if (devise) parametres.set("currency", devise);
  const requete = parametres.size ? `?${parametres}` : "";
  return appeler<unknown>(cle, `/payment_methods${requete}`, { methode: "GET", delaiMs }, f);
}

/** L'état d'un paiement, relu chez Payiz (il fait foi) ; `delaiMs` raccourcit l'attente (relecture d'arrière-plan). */
export function lirePaiementPayiz(cle: string, payizId: string, f: typeof fetch = fetch, delaiMs = DELAI_MS): Promise<PaiementPayiz> {
  return appeler<PaiementPayiz>(cle, `/payments/${encodeURIComponent(payizId)}`, { methode: "GET", delaiMs }, f);
}
