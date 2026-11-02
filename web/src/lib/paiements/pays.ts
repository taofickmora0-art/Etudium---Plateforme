// Les pays du paiement Mobile Money (demande du 2 novembre 2026 : les payeurs ne sont pas tous béninois). Payiz désigne
// un pays par son code ISO 3166 alpha-3 (« BEN ») ; son nom en français vient du navigateur ou du serveur
// (`Intl.DisplayNames`), qui attend le code alpha-2. Module sans rien du serveur : l'écran s'en sert aussi.

/** Code alpha-3 → [alpha-2, indicatif, « 0 » national à retirer devant le numéro]. Les pays d'Afrique. */
const PAYS: Record<string, [string, string, boolean?]> = {
  AGO: ["AO", "+244"],
  BDI: ["BI", "+257"],
  BEN: ["BJ", "+229"],
  BFA: ["BF", "+226"],
  BWA: ["BW", "+267"],
  CAF: ["CF", "+236"],
  CIV: ["CI", "+225"],
  CMR: ["CM", "+237"],
  COD: ["CD", "+243", true],
  COG: ["CG", "+242"],
  COM: ["KM", "+269"],
  CPV: ["CV", "+238"],
  DJI: ["DJ", "+253"],
  DZA: ["DZ", "+213", true],
  EGY: ["EG", "+20", true],
  ERI: ["ER", "+291", true],
  ETH: ["ET", "+251", true],
  GAB: ["GA", "+241"],
  GHA: ["GH", "+233", true],
  GIN: ["GN", "+224"],
  GMB: ["GM", "+220"],
  GNB: ["GW", "+245"],
  GNQ: ["GQ", "+240"],
  KEN: ["KE", "+254", true],
  LBR: ["LR", "+231", true],
  LBY: ["LY", "+218", true],
  LSO: ["LS", "+266"],
  MAR: ["MA", "+212", true],
  MDG: ["MG", "+261", true],
  MLI: ["ML", "+223"],
  MOZ: ["MZ", "+258"],
  MRT: ["MR", "+222"],
  MUS: ["MU", "+230"],
  MWI: ["MW", "+265", true],
  NAM: ["NA", "+264", true],
  NER: ["NE", "+227"],
  NGA: ["NG", "+234", true],
  RWA: ["RW", "+250", true],
  SDN: ["SD", "+249", true],
  SEN: ["SN", "+221"],
  SLE: ["SL", "+232", true],
  SOM: ["SO", "+252", true],
  SSD: ["SS", "+211", true],
  STP: ["ST", "+239"],
  SWZ: ["SZ", "+268"],
  SYC: ["SC", "+248"],
  TCD: ["TD", "+235"],
  TGO: ["TG", "+228"],
  TUN: ["TN", "+216"],
  TZA: ["TZ", "+255", true],
  UGA: ["UG", "+256", true],
  ZAF: ["ZA", "+27", true],
  ZMB: ["ZM", "+260", true],
  ZWE: ["ZW", "+263", true],
};

let noms: Intl.DisplayNames | null | undefined;

/** « Bénin », « Côte d’Ivoire » ; un code inconnu (ou sans `Intl.DisplayNames`) reste tel quel. */
export function nomPays(code: string): string {
  const alpha2 = PAYS[code]?.[0];
  if (!alpha2) return code;
  if (noms === undefined) {
    try {
      noms = new Intl.DisplayNames(["fr"], { type: "region" });
    } catch {
      noms = null;
    }
  }
  return noms?.of(alpha2) ?? code;
}

/** « +229 » ; null pour un pays hors de la table (l'indicatif vient alors de Payiz). */
export const indicatifDuPays = (code: string): string | null => PAYS[code]?.[1] ?? null;

/** Le « 0 » mis devant les numéros dans le pays mais absent du numéro international (Ghana : 024… → +233 24…). */
export const zeroNational = (code: string): boolean => PAYS[code]?.[2] === true;

/** Un code ISO 3166 alpha-3, en majuscules. */
export const codePaysValide = (v: unknown): v is string => typeof v === "string" && /^[A-Z]{3}$/.test(v);
