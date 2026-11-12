import { createHmac, timingSafeEqual } from "node:crypto";
import type { OperateurPaiement, PaysPaiement } from "@/lib/abonnement/types";
import { alpha3De, indicatifDuPays, nomPays } from "./pays";
import { PREFIXE_SASPAY, type Verdict } from "./regles";

// SasPay (https://docs.saspay.me), le prestataire de secours de Payiz (demande du 12 novembre 2026 : Payiz ne couvre pas
// plusieurs pays d'Afrique). Repris du projet flashSMS (backend/src/services/payment/saspay.js). Sur le serveur
// seulement : la clé secrète ne quitte jamais le serveur. `fetch` est injectable pour les tests.
//
// La demande part directement sur le téléphone (« softpay », POST /payments/softpay/). Deux exceptions qui viennent des
// opérateurs : Wave et Orange Money font valider sur leur propre page (SasPay rend une `checkout_url`), et Orange Côte
// d'Ivoire et Orange Burkina exigent un code de paiement que le payeur génère d'avance (champ `otp`).
//
// ⚠️ Le nom de SasPay n'apparaît jamais côté étudiant : ses refus ont un message pour l'équipe (le journal du serveur)
// et un autre pour l'étudiant (messageErreurSasPay). Son identifiant de paiement est gardé préfixé « softpay: ».

export const API_SASPAY = "https://api.saspay.me/api/v1";
export { estSasPay, PREFIXE_SASPAY } from "./regles";
const DELAI_MS = 15_000;
/** La liste se lit sur le chemin de la page de souscription : 5 secondes par appel au plus (revue). */
const DELAI_CATALOGUE_MS = 5000;
/** Une notification plus ancienne est refusée : elle a pu être rejouée. */
const TOLERANCE_SIGNATURE_S = 300;

const idDe = (ref: string) => encodeURIComponent(ref.startsWith(PREFIXE_SASPAY) ? ref.slice(PREFIXE_SASPAY.length) : ref);

/** Une erreur de l'API (`error.code`) ; `delai` si SasPay n'a pas répondu à temps, `reseau` s'il est injoignable. */
export class ErreurSasPay extends Error {
  code: string;
  statut: number;

  constructor(code: string, statut: number, message: string) {
    super(message);
    this.name = "ErreurSasPay";
    this.code = code;
    this.statut = statut;
  }
}

type Brut = Record<string, unknown>;
const objet = (v: unknown): Brut => (v && typeof v === "object" && !Array.isArray(v) ? (v as Brut) : {});
/** Certaines réponses sont enveloppées dans « data », d'autres non. */
const enObjet = (v: unknown): Brut => {
  const o = objet(v);
  return o.data && typeof o.data === "object" && !Array.isArray(o.data) ? (o.data as Brut) : o;
};
/** Une liste brute, enveloppée dans « data », ou paginée dans « results ». */
function enListe(v: unknown): unknown[] {
  let r: unknown = v;
  if (r && !Array.isArray(r) && typeof r === "object") r = (r as Brut).data ?? r;
  if (r && !Array.isArray(r) && typeof r === "object") r = (r as Brut).results;
  return Array.isArray(r) ? r : [];
}
const texte = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const nombre = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.round(n) : null;
};

type Requete = { methode: "GET" | "POST"; corps?: unknown; idempotence?: string; delaiMs?: number };

async function appeler(cle: string, chemin: string, { methode, corps, idempotence, delaiMs = DELAI_MS }: Requete, f: typeof fetch): Promise<unknown> {
  const headers: Record<string, string> = { Authorization: `Bearer ${cle}`, Accept: "application/json" };
  if (corps !== undefined) headers["Content-Type"] = "application/json";
  if (idempotence) headers["Idempotency-Key"] = idempotence;
  let reponse: Response;
  try {
    reponse = await f(`${API_SASPAY}${chemin}`, {
      method: methode,
      headers,
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(delaiMs),
      cache: "no-store",
    });
  } catch (e) {
    const delai = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ErreurSasPay(delai ? "delai" : "reseau", 0, delai ? "SasPay n’a pas répondu à temps." : "SasPay est injoignable.");
  }
  const brut = await reponse.text().catch(() => "");
  let donnees: unknown = null;
  try {
    donnees = brut ? JSON.parse(brut) : null;
  } catch {
    donnees = null;
  }
  if (!reponse.ok) {
    const o = objet(donnees);
    const e = o.error && typeof o.error === "object" ? objet(o.error) : o;
    const message = texte(e.message) || texte(e.detail) || `SasPay a répondu ${reponse.status}.`;
    throw new ErreurSasPay(texte(e.code) || "inconnue", reponse.status, message.slice(0, 300));
  }
  return donnees;
}

// ─── Payer ──────────────────────────────────────────────────────────────────────────────────────────

export type DemandeSasPay = {
  /** Notre identifiant du paiement (gardé dans les métadonnées). */
  paiementId: string;
  /** Une par essai : si la réponse se perd, redemander rend LA MÊME demande au lieu d'en pousser une seconde. */
  cleIdempotence: string;
  /** En francs CFA (SasPay convertit hors zone franc). */
  montant: number;
  description: string;
  /** ISO 3166 alpha-2 (« CI »). */
  pays: string;
  /** Le code SasPay du réseau (« orange_ci »). */
  reseau: string;
  /** Normalisé : « +2250700000000 ». */
  telephone: string;
  client: { email: string; prenom: string; nom: string };
  /** Où revient l'étudiant après la page de l'opérateur (Wave, Orange Money). */
  urlRetour: string;
  /** Le code de paiement généré d'avance par l'étudiant (Orange Côte d'Ivoire, Orange Burkina). */
  codePaiement?: string | null;
};

/** Envoie la demande de paiement ; rend la référence (« softpay:… ») et, pour Wave et Orange Money, la page à ouvrir. */
export async function payerSasPay(cle: string, d: DemandeSasPay, f: typeof fetch = fetch): Promise<{ ref: string; redirection: string | null }> {
  const corps: Brut = {
    amount: `${d.montant}.00`,
    currency: "XOF",
    country: d.pays,
    network: d.reseau,
    description: d.description,
    customer: { email: d.client.email, first_name: d.client.prenom, last_name: d.client.nom, phone: d.telephone },
    return_url: d.urlRetour,
    metadata: { reference: d.paiementId },
  };
  const code = d.codePaiement?.trim();
  if (code) corps.otp = code;
  const requete: Requete = { methode: "POST", corps, idempotence: d.cleIdempotence };
  let reponse: unknown;
  try {
    reponse = await appeler(cle, "/payments/softpay/", requete, f);
  } catch (e) {
    // Un délai dépassé n'est pas un refus : la demande a pu partir. La clé d'idempotence rend le second envoi sûr.
    if (!(e instanceof ErreurSasPay && e.code === "delai")) throw e;
    reponse = await appeler(cle, "/payments/softpay/", requete, f);
  }
  const paiement = enObjet(reponse);
  const id = texte(paiement.id) || (typeof paiement.id === "number" ? String(paiement.id) : "");
  if (!id) throw new ErreurSasPay("sans_identifiant", 200, "SasPay n’a pas renvoyé d’identifiant de paiement.");
  const url = texte(paiement.checkout_url);
  return { ref: `${PREFIXE_SASPAY}${id}`, redirection: /^https:\/\//.test(url) ? url : null };
}

// ─── Lire un paiement ───────────────────────────────────────────────────────────────────────────────

export type LectureSasPay = { status: string; currency: string; requestedAmount: number | null };

/** L'état d'un paiement, revérifié par SasPay chez l'opérateur (il fait foi). */
export async function verifierSasPay(cle: string, ref: string, f: typeof fetch = fetch, delaiMs = DELAI_MS): Promise<LectureSasPay> {
  const p = enObjet(await appeler(cle, `/payments/${idDe(ref)}/verify/`, { methode: "GET", delaiMs }, f));
  return { status: texte(p.status).toUpperCase(), currency: texte(p.currency).toUpperCase() || "XOF", requestedAmount: nombre(p.requested_amount) };
}

/**
 * Ce que dit un paiement SasPay. Réussi en francs CFA : le montant demandé, que la base compare au sien. Hors zone franc,
 * SasPay a converti au taux du jour : c'est notre demande, créée par le serveur à notre prix, qui a été payée.
 */
/** Les fins sans paiement : échouée, annulée, expirée, sautée (code de paiement manquant), rejetée, refusée. */
const FINS_SANS_PAIEMENT = new Set(["FAILED", "CANCELLED", "EXPIRED", "SKIPPED", "REJECTED", "DECLINED"]);

export function verdictSasPay(p: LectureSasPay, montant: number): Verdict {
  if (p.status === "SUCCESS") return { action: "confirmer", montant: p.currency === "XOF" && p.requestedAmount !== null ? p.requestedAmount : montant };
  if (FINS_SANS_PAIEMENT.has(p.status)) return { action: "echec", statut: "echoue", motif: null };
  // En cours (PENDING, PROCESSING…) ou inconnu : on attend, plutôt que de laisser repartir une seconde demande.
  return { action: "attendre" };
}

// Les mots des opérateurs (en français ou en anglais), vers les motifs qu'Étudium connaît (noter_echec, 0049).
const MOTIFS: [string, RegExp][] = [
  ["operator_unavailable", /solde operateur|operator balance|gateway balance|merchant balance|solde marchand/],
  ["insufficient_funds", /insuffisant|insufficient|not enough|low balance|fonds|funds|solde/],
  ["declined", /\bpin\b|code secret|mot de passe|password|wrong code|invalid code|code incorrect|code errone/],
  ["operator_limit", /plafond|limit/],
  ["invalid_phone", /payer not found|account not found|wallet not found|subscriber|compte introuvable|numero introuvable|invalid phone|invalid msisdn|numero invalide|not registered|non enregistre/],
  ["timeout", /expir|timeout|timed out|time out|delai/],
  ["payer_declined", /refus|rejet|reject|declin|denied|annul|cancel|not approved|non approuve|abandon/],
  ["operator_unavailable", /gateway|passerelle|indisponible|unavailable|service|internal|interne|technique|technical|maintenance|no route|aucune route|injoignable|system error/],
];
const normaliser = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Pourquoi un paiement a échoué, d'après la dernière tentative chez l'opérateur ; « unknown » à défaut. */
export async function motifSasPay(cle: string, ref: string, f: typeof fetch = fetch, delaiMs = DELAI_MS): Promise<string> {
  try {
    const t = enObjet(await appeler(cle, `/transactions/${idDe(ref)}/`, { methode: "GET", delaiMs }, f));
    const dansLOrdre = (lignes: unknown, garder: (l: Brut) => boolean) =>
      (Array.isArray(lignes) ? lignes : [])
        .map(objet)
        .filter(garder)
        .sort((a, b) => texte(a.created_at).localeCompare(texte(b.created_at)));
    const tentatives = dansLOrdre(t.attempts, (l) => l.status === "FAILED");
    const passages = dansLOrdre(t.status_logs, (l) => l.to_status === "FAILED" || l.to_status === "CANCELLED");
    const derniere = tentatives.at(-1);
    const textes = [texte(derniere?.error_code), texte(derniere?.error_message), texte(passages.at(-1)?.reason)].filter(Boolean).map(normaliser);
    for (const t of textes) for (const [code, motif] of MOTIFS) if (motif.test(t)) return code;
  } catch {
    // Le motif n'est qu'un plus : l'échec est noté quand même.
  }
  return "unknown";
}

// ─── Les messages pour l'étudiant ───────────────────────────────────────────────────────────────────

const MESSAGES: Record<string, string> = {
  invalid_method: "Ce moyen de paiement n’est pas disponible pour le moment. Choisissez-en un autre.",
  no_route_available: "Ce moyen de paiement ne répond pas pour le moment. Réessayez dans un instant ou choisissez-en un autre.",
  invalid_customer: "Ce numéro n’est pas valide pour le pays choisi. Vérifiez-le.",
  invalid_country: "Le paiement n’est pas proposé dans ce pays pour le moment. Choisissez un autre pays.",
  prepayment_otp_missing: "Votre opérateur demande un code de paiement : générez-le sur votre téléphone, puis saisissez-le.",
  invalid_otp: "Ce code de paiement n’est pas valide. Générez-en un nouveau, puis réessayez.",
  expired_otp: "Ce code de paiement a expiré. Générez-en un nouveau, puis réessayez.",
};

/** Un refus de SasPay, en clair, sans son nom ; tout le reste (clé, compte, réseau) : indisponible. */
export const messageErreurSasPay = (code: string): string => MESSAGES[code] ?? "Le paiement est indisponible pour le moment. Réessayez plus tard.";

/** Le refus se dit à l'étudiant (numéro, code…) ; sinon il regarde l'équipe (clé, compte) et s'écrit dans le journal. */
export const erreurSasPayTraduite = (code: string): boolean => code in MESSAGES;

// ─── Le catalogue ───────────────────────────────────────────────────────────────────────────────────

type Reseau = { code: string; nom: string; page?: boolean };
const R = (code: string, nom: string, page = false): Reseau => ({ code, nom, page });

/**
 * Les réseaux que SasPay encaisse sans étape de plus, par pays (alpha-2), d'après sa documentation (relevé de flashSMS,
 * 12 novembre 2026) : sous leur nom d'aujourd'hui. Sans les réseaux qui demandent un code APRÈS la demande (Wizall,
 * Coris) : l'écran ne sait pas faire cette étape. Ce n'est qu'un état par défaut : la liste vivante de SasPay fait foi.
 */
const RESEAUX: Record<string, Reseau[]> = {
  BJ: [R("mtn_bj", "MTN MoMo"), R("moov_bj", "Moov Money"), R("celtiis_bj", "Celtiis Cash")],
  BF: [R("orange_bf", "Orange Money", true), R("moov_bf", "Moov Money")],
  CM: [R("mtn_cm", "MTN MoMo"), R("orange_cm", "Orange Money", true)],
  CI: [R("wave_ci", "Wave", true), R("orange_ci", "Orange Money", true), R("mtn_ci", "MTN MoMo"), R("moov_ci", "Moov Money")],
  GH: [R("mtn_gh", "MTN MoMo"), R("vodafone_gh", "Telecel Cash (ex-Vodafone Cash)"), R("tigo_gh", "AT Money (ex-AirtelTigo)")],
  GN: [R("mtn_gn", "MTN MoMo")],
  KE: [R("mpesa_ke", "M-Pesa")],
  MW: [R("airtel_mw", "Airtel Money"), R("tnm_mw", "TNM Mpamba")],
  ML: [R("orange_ml", "Orange Money", true), R("moov_ml", "Moov Money")],
  NE: [R("airtel_ne", "Airtel Money")],
  NG: [R("mtn_ng", "MTN MoMo"), R("airtel_ng", "Airtel Money")],
  UG: [R("mtn_ug", "MTN MoMo"), R("airtel_ug", "Airtel Money")],
  CD: [R("vodacom_cd", "M-Pesa (Vodacom)"), R("orange_cd", "Orange Money", true), R("airtel_cd", "Airtel Money")],
  RW: [R("mtn_rw", "MTN MoMo"), R("airtel_rw", "Airtel Money")],
  SN: [R("wave_sn", "Wave", true), R("orange_sn", "Orange Money", true), R("freemoney_sn", "Mixx by Yas (ex-Free Money)")],
  TZ: [R("mpesa_tz", "M-Pesa (Vodacom)"), R("tigo_tz", "Mixx by Yas (ex-Tigo Pesa)"), R("airtel_tz", "Airtel Money"), R("halopesa_tz", "HaloPesa")],
  TG: [R("moov_tg", "Moov Money Flooz"), R("togocel", "Mixx by Yas (ex-T-Money)")],
  ZM: [R("mtn_zm", "MTN MoMo"), R("airtel_zm", "Airtel Money"), R("zamtel_zm", "Zamtel Kwacha")],
};

/** Les marques qu'on sait payer sans étape de plus : un réseau que SasPay ajoute dans un pays connu apparaît tout seul. */
const MARQUES: Record<string, [string, boolean]> = {
  wave: ["Wave", true],
  orange: ["Orange Money", true],
  mtn: ["MTN MoMo", false],
  moov: ["Moov Money", false],
  airtel: ["Airtel Money", false],
  mpesa: ["M-Pesa", false],
  vodacom: ["M-Pesa (Vodacom)", false],
  celtiis: ["Celtiis Cash", false],
};
/** Mobicash est l'ancien nom de Moov Money au Mali, déjà proposé : deux choix pour un même compte prêteraient à confusion. */
const ECARTES = new Set(["mobi_cash_ml"]);

/**
 * Les réseaux qui exigent un code de paiement généré d'avance. Ce n'est qu'un repli : SasPay le dit lui-même
 * (`/pricing/my-rates/`). « {montant} » est remplacé par la somme à payer, au moment d'afficher la liste.
 */
const CODES_CONNUS: Record<string, string> = {
  orange_ci: "Composez #144*82# sur votre téléphone pour obtenir votre code de paiement.",
  orange_bf: "Composez *144*4*6*{montant}# sur votre téléphone pour obtenir votre code de paiement.",
};
const CONSIGNE_GENERIQUE = "Votre opérateur demande un code de paiement : générez-le depuis son menu Mobile Money, puis saisissez-le ici.";

/** Les réseaux vivants, par pays (alpha-2) : { BJ: { mtn_bj: "MTN Benin" } }. Les réseaux ne nomment leur pays que par un numéro. */
async function reseauxActifs(cle: string, f: typeof fetch): Promise<Record<string, Record<string, string>>> {
  const pays = new Map<string, string>();
  for (const l of enListe(await appeler(cle, "/countries/", { methode: "GET", delaiMs: DELAI_CATALOGUE_MS }, f))) {
    const o = objet(l);
    if (o.id !== undefined && texte(o.iso_code)) pays.set(String(o.id), texte(o.iso_code).toUpperCase());
  }
  const actifs: Record<string, Record<string, string>> = {};
  // Vingt pages de cent au plus : une réponse qui boucle sur elle-même ne retient pas le serveur.
  for (let page = 1; page && page <= 20; ) {
    const reponse = await appeler(cle, `/networks/?page=${page}&page_size=100`, { methode: "GET", delaiMs: DELAI_CATALOGUE_MS }, f);
    for (const l of enListe(reponse)) {
      const o = objet(l);
      const codePays = pays.get(String(o.country));
      if (o.is_active !== true || !codePays || !texte(o.code)) continue;
      (actifs[codePays] ??= {})[texte(o.code)] = texte(o.name) || texte(o.code);
    }
    page = objet(reponse).next ? page + 1 : 0;
  }
  return actifs;
}

/** Ce que SasPay dit des codes de paiement, par réseau ; null s'il ne répond pas (la table de repli sert alors). */
async function codesDePaiement(cle: string, f: typeof fetch): Promise<Record<string, { requis: boolean; consigne: string | null }> | null> {
  try {
    const codes: Record<string, { requis: boolean; consigne: string | null }> = {};
    for (const l of enListe(await appeler(cle, "/pricing/my-rates/", { methode: "GET", delaiMs: DELAI_CATALOGUE_MS }, f))) {
      const o = objet(l);
      const code = texte(o.network_code) || texte(o.network) || texte(o.code);
      if (!code || !("otp_required" in o || "otp_instructions" in o)) continue;
      // Une consigne qui nommerait SasPay n'est pas montrée : l'étudiant ne doit jamais le voir (la nôtre la remplace).
      const consigne = texte(o.otp_instructions);
      codes[code] = { requis: o.otp_required === true, consigne: consigne && !/saspay/i.test(consigne) ? consigne : null };
    }
    return Object.keys(codes).length ? codes : null;
  } catch {
    return null;
  }
}

function operateur(code: string, nom: string, page: boolean, codes: Record<string, { requis: boolean; consigne: string | null }> | null): OperateurPaiement {
  const dit = codes?.[code];
  const consigne = dit ? (dit.requis ? (dit.consigne ?? CODES_CONNUS[code] ?? CONSIGNE_GENERIQUE) : null) : (CODES_CONNUS[code] ?? null);
  // Un réseau à code de paiement ne fait pas valider sur sa page : le code tranche.
  const validation = consigne ? "code" : page ? "page" : undefined;
  return {
    code,
    nom,
    logo: null,
    prefixes: [],
    devise: "XOF",
    montantAPayer: null,
    minimum: null,
    maximum: null,
    ...(validation ? { validation } : {}),
    ...(consigne ? { consigne } : {}),
  };
}

/**
 * Le catalogue tel que SasPay l'encaisse EN CE MOMENT (pays en alpha-3, triés par nom) : sans les réseaux qu'il a
 * coupés, avec ceux qu'il a ajoutés dans un pays connu. null s'il ne répond pas : on ne propose pas un pays qu'on ne
 * saurait pas encaisser.
 */
export async function catalogueSasPay(cle: string, f: typeof fetch = fetch): Promise<PaysPaiement[] | null> {
  // Les réseaux et les codes de paiement se lisent en même temps : la page attend la plus lente des deux.
  const [lus, codes] = await Promise.all([reseauxActifs(cle, f).catch(() => null), codesDePaiement(cle, f)]);
  if (!lus) return null;
  const actifs = lus;
  const liste: PaysPaiement[] = [];
  for (const [alpha2, reseaux] of Object.entries(RESEAUX)) {
    const code = alpha3De(alpha2);
    const indicatif = code ? indicatifDuPays(code) : null;
    if (!code || !indicatif) continue;
    const vivants = actifs[alpha2] ?? {};
    const connus = new Set(reseaux.map((r) => r.code));
    const operateurs = reseaux.filter((r) => vivants[r.code]).map((r) => operateur(r.code, r.nom, Boolean(r.page), codes));
    for (const nouveau of Object.keys(vivants).sort()) {
      const marque = MARQUES[nouveau.split("_")[0]];
      if (marque && !connus.has(nouveau) && !ECARTES.has(nouveau)) operateurs.push(operateur(nouveau, marque[0], marque[1], codes));
    }
    if (operateurs.length) liste.push({ code, nom: nomPays(code), indicatif, operateurs });
  }
  return liste.length ? liste.sort((a, b) => a.nom.localeCompare(b.nom, "fr")) : null;
}

// ─── Les notifications ──────────────────────────────────────────────────────────────────────────────

/**
 * Les notifications de SasPay sont signées : HMAC-SHA256, en hexadécimal, de « horodatage.corps brut » avec le secret du
 * webhook (en-têtes X-Webhook-Timestamp et X-Webhook-Signature). Refusée au-delà de 5 minutes.
 */
export function verifierSignatureSasPay(corps: string, horodatage: string | null, signature: string | null, secret: string, maintenant = Date.now()): boolean {
  if (!secret || !horodatage || !/^\d+$/.test(horodatage) || !signature || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  if (Math.abs(maintenant / 1000 - Number(horodatage)) > TOLERANCE_SIGNATURE_S) return false;
  const attendue = Buffer.from(createHmac("sha256", secret).update(`${horodatage}.${corps}`).digest("hex"), "utf8");
  const recue = Buffer.from(signature.toLowerCase(), "utf8");
  return recue.length === attendue.length && timingSafeEqual(recue, attendue);
}
