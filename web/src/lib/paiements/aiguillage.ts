import type { MoyensDePaiement, Operateur, OperateurPaiement, PaysPaiement } from "@/lib/abonnement/types";

// L'aiguillage (12 novembre 2026, repris de flashSMS : backend/src/services/payment/aiguillage.js) : DEUX prestataires,
// UNE liste. Payiz encaisse en premier, mais il ne couvre pas tous les pays, ni, dans un pays couvert, tous les
// opérateurs ; SasPay prend ce qui manque. L'étudiant voit une seule liste et ne sait jamais qui encaisse : le serveur
// retient, opérateur par opérateur, à qui envoyer la demande. Module pur : ni base, ni réseau.
//
// ⚠️ Les deux ne nomment pas un opérateur pareil (« mtn » chez l'un, « mtn_bj » chez l'autre ; « yas » contre
// « togocel ») : on compare la MARQUE, et les anciens noms connus. Sans ça, MTN s'afficherait deux fois.

export type Prestataire = "payiz" | "saspay";

/** Les anciens noms à reconnaître en plus de la marque du code (relevé de flashSMS), par code SasPay. */
const ALIAS: Record<string, RegExp[]> = {
  moov_bf: [/onatel/, /telmob/],
  moov_ml: [/sotelma/, /malitel/],
  mtn_gn: [/areeba/],
  vodafone_gh: [/telecel/, /vodafone/],
  tigo_gh: [/airteltigo/, /\bat\b/],
  togocel: [/togo\s*tel/, /togocel/, /t\s?money/, /\byas\b/],
  freemoney_sn: [/\bfree\b/, /\byas\b/],
  tigo_tz: [/\byas\b/, /\btigo\b/],
  halopesa_tz: [/halotel/, /halopesa/, /viettel/],
  mpesa_ke: [/safaricom/],
  mpesa_tz: [/vodacom/],
  vodacom_cd: [/vodacom/, /m\s?pesa/],
  airtel_rw: [/\btigo\b/],
};

const normaliser = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[_\-.()]+/g, " ")
    .trim();
/** La marque portée par un code, quelle que soit sa forme : « MTN-BJ » → « mtn ». */
const marque = (code: string) => normaliser(code).split(/\s+/)[0] ?? "";

/** Le nom d'un opérateur correspond-il à ce code (sa marque, ou un ancien nom connu) ? Un nom vide ne correspond à rien. */
function correspond(code: string, nom: string): boolean {
  const n = normaliser(nom);
  const m = marque(code).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!n || !m) return false;
  return new RegExp(`\\b${m}\\b`).test(n) || (ALIAS[code.toLowerCase()] ?? []).some((r) => r.test(n));
}

/** Deux opérateurs d'un même pays sont-ils le même ? */
export const memeOperateur = (a: Pick<OperateurPaiement, "code" | "nom">, b: Pick<OperateurPaiement, "code" | "nom">): boolean =>
  marque(a.code) === marque(b.code) || correspond(a.code, b.nom) || correspond(b.code, a.nom);

/** La liste fusionnée (sans aucun nom de prestataire : elle part au navigateur) et, gardé sur le serveur, qui encaisse quoi. */
export type MoyensRoutes = {
  moyens: MoyensDePaiement;
  /** Le prestataire de cet opérateur dans ce pays ; sans opérateur, Payiz s'il encaisse ce pays (il déduit l'opérateur du numéro). */
  prestataireDe(pays: string, operateur: Operateur | null): Prestataire | null;
};

const trier = (liste: PaysPaiement[]) => liste.sort((a, b) => (a.code === "BEN" ? -1 : b.code === "BEN" ? 1 : a.nom.localeCompare(b.nom, "fr")));

/**
 * Fusionne la liste de Payiz (prioritaire) et celle de SasPay ; null si aucune n'est là. Les opérateurs de SasPay
 * reprennent le logo de la même marque chez Payiz ; leur consigne de code reçoit le montant (« *144*4*6*12000# »).
 */
export function fusionnerMoyens(payiz: MoyensDePaiement | null, saspay: PaysPaiement[] | null, montant: number | null): MoyensRoutes | null {
  if (!payiz && !saspay) return null;
  const routes = new Map<string, Prestataire>();
  const cle = (pays: string, code: string) => `${pays}:${code}`;
  const parPays = new Map<string, PaysPaiement>();
  for (const p of payiz?.pays ?? []) {
    parPays.set(p.code, { ...p, operateurs: [...p.operateurs] });
    for (const o of p.operateurs) routes.set(cle(p.code, o.code), "payiz");
  }
  const logos = new Map<string, string>();
  for (const o of (payiz?.pays ?? []).flatMap((p) => p.operateurs)) if (o.logo && !logos.has(marque(o.code))) logos.set(marque(o.code), o.logo);

  for (const p of saspay ?? []) {
    const cible = parPays.get(p.code) ?? { ...p, operateurs: [] };
    const avant = [...cible.operateurs];
    for (const o of p.operateurs) {
      if (avant.some((d) => memeOperateur(d, o))) continue;
      cible.operateurs.push({
        ...o,
        logo: o.logo ?? logos.get(marque(o.code)) ?? null,
        ...(o.consigne ? { consigne: o.consigne.replace("{montant}", montant && montant > 0 ? String(montant) : "montant") } : {}),
      });
      routes.set(cle(p.code, o.code), "saspay");
    }
    if (cible.operateurs.length) parPays.set(p.code, cible);
  }

  const payizPays = new Set((payiz?.pays ?? []).map((p) => p.code));
  return {
    moyens: payiz && !saspay ? payiz : { pays: trier([...parPays.values()]), repli: false },
    prestataireDe: (pays, operateur) => (operateur ? (routes.get(cle(pays, operateur)) ?? null) : payizPays.has(pays) ? "payiz" : null),
  };
}
