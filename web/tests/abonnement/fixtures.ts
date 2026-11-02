// Données de test du lot 2 : une carte de paiement telle que la base la renvoie (0049, snake_case).

export const PAIEMENT_ID = "11111111-1111-4111-8111-111111111111";
export const FORMULE_ID = "22222222-2222-4222-8222-222222222222";

export const carteSql = (champs: Record<string, unknown> = {}) => ({
  id: PAIEMENT_ID,
  statut: "en_attente",
  formule: { code: "standard", nom: "Standard", duree_mois: 6 },
  prix_initial: 15000,
  remise: 3000,
  montant: 12000,
  code: "PROMO20",
  operateur: null,
  operateur_nom: null,
  pays: null,
  telephone_masque: null,
  motif_echec: null,
  numero_recu: null,
  payiz_id: null,
  cree_le: "2026-11-01T10:00:00Z",
  essai_le: null,
  confirme_le: null,
  abonnement: null,
  ...champs,
});

const moyen = (pays: string, indicatif: string, code: string, nom: string, prefixes: string[]) => ({
  object: "payment_method",
  country: pays,
  dial_code: indicatif,
  operator: { code, name: nom, logo_url: `https://cdn.payiz.app/operateurs/${code}.png` },
  phone_prefixes: prefixes,
  currency: "XOF",
  min_amount: 1000,
  max_amount: 2_000_000,
});

/** Les moyens de paiement de Payiz (GET /v1/payment_methods) : le Bénin avec Celtiis, le Togo, et un pays hors de la table. */
export const MOYENS_PAYIZ = {
  object: "list",
  has_more: false,
  url: "/v1/payment_methods",
  data: [
    moyen("BEN", "+229", "mtn", "MTN Mobile Money", ["0142", "0197"]),
    moyen("BEN", "+229", "moov", "Moov Money", ["0155"]),
    moyen("BEN", "+229", "celtiis", "Celtiis Cash", ["0143"]),
    moyen("TGO", "+228", "togocel", "Mixx by Yas", ["90", "91", "92", "93", "70"]),
    moyen("XKX", "+383", "ipko", "IPKO", []),
  ],
};

/** Un paiement Payiz (GET /v1/payments/{id}). */
export const payizSql = (champs: Record<string, unknown> = {}) => ({
  id: "pay_1",
  status: "processing",
  amount: 12000,
  currency: "XOF",
  reference: PAIEMENT_ID,
  expires_at: null,
  latest_attempt: { id: "att_1", status: "pending", failure_code: null, operator: "mtn", phone: "+229 01 •• •• •• 00" },
  ...champs,
});
