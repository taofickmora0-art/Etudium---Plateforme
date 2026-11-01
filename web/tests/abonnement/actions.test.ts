import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { carteSql, FORMULE_ID, PAIEMENT_ID, payizSql } from "./fixtures";

// Les actions de la souscription (lot 2) : préparer en base, lancer chez Payiz, suivre, réessayer ; et la
// resynchronisation des paiements restés en attente (onglet fermé, pas de notification en local).

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({ demoModeActive: () => false }));

const { essayerCode, payer, reessayer, suivrePaiement } = await import("@/lib/abonnement/actions");
const { resynchroniserEnAttente } = await import("@/lib/paiements/synchroniser");

const fetchPayiz = vi.fn<typeof fetch>();
const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status });
const corpsEnvoye = (i = 0) => JSON.parse(String(fetchPayiz.mock.calls[i][1]?.body));
const entete = (i: number, nom: string) => (fetchPayiz.mock.calls[i][1]?.headers as Record<string, string>)[nom];

beforeEach(() => {
  faux.vider();
  fetchPayiz.mockReset();
  vi.stubGlobal("fetch", fetchPayiz);
  vi.stubEnv("PAYIZ_CLE_SECRETE", "sk_test_x");
  vi.stubEnv("PAIEMENT_JETON", "J");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ENTREE = { formuleId: FORMULE_ID, code: "", telephone: "01 42 00 00 00", operateur: "mtn" as const };

describe("Essayer un code", () => {
  it("rend le montant ou le refus de la base", async () => {
    faux.repondre("rpc.essayer_code", { data: { ok: true, code_id: "c", prix_initial: 15000, remise: 3000, montant: 12000 } });
    expect(await essayerCode(FORMULE_ID, " promo20 ")).toEqual({ ok: true, prixInitial: 15000, remise: 3000, montant: 12000 });
    expect(faux.de("rpc", "essayer_code")[0].valeurs).toEqual({ p_code: "promo20", p_formule: FORMULE_ID });
    faux.repondre("rpc.essayer_code", { data: { ok: false, message: "Ce code a expiré." } });
    expect(await essayerCode(FORMULE_ID, "VIEUX")).toEqual({ ok: false, message: "Ce code a expiré." });
  });
});

describe("Payer", () => {
  it("numéro invalide : message, sans appel", async () => {
    expect(await payer({ ...ENTREE, telephone: "01 42" })).toEqual({ etat: "erreur", message: "Saisissez un numéro béninois à 10 chiffres (01 XX XX XX XX)." });
    expect(faux.appels).toEqual([]);
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("sans configuration : « Les paiements ouvrent bientôt. », sans appel à Payiz", async () => {
    vi.stubEnv("PAYIZ_CLE_SECRETE", "");
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ repris: false }) });
    expect(await payer(ENTREE)).toEqual({ etat: "erreur", message: "Les paiements ouvrent bientôt." });
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("paiement lancé : Payiz puis noter_essai avec le numéro masqué", async () => {
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ repris: false }) });
    fetchPayiz.mockResolvedValueOnce(reponse(201, payizSql()));
    faux.repondre("rpc.noter_essai", { data: carteSql({ payiz_id: "pay_1", essai_le: "2026-11-01T10:00:00Z", operateur: "mtn", telephone_masque: "+229 01 •• •• •• 00" }) });

    const etape = await payer(ENTREE);

    expect(faux.de("rpc", "preparer_paiement")[0].valeurs).toEqual({ p_formule: FORMULE_ID, p_code: null });
    expect(fetchPayiz.mock.calls[0][0]).toBe("https://api.payiz.app/v1/payments");
    expect(corpsEnvoye()).toMatchObject({ amount: 12000, reference: PAIEMENT_ID, payer: { phone: "+2290142000000", operator: "mtn" } });
    expect(entete(0, "Idempotency-Key")).toBe(PAIEMENT_ID);
    expect(faux.de("rpc", "noter_essai")[0].valeurs).toEqual({
      p_paiement: PAIEMENT_ID,
      p_payiz: "pay_1",
      p_operateur: "mtn",
      p_telephone_masque: "+229 01 •• •• •• 00",
      p_jeton: "J",
    });
    expect(etape).toMatchObject({ etat: "attente", finAttente: "2026-11-01T10:03:00.000Z", paiement: { telephoneMasque: "+229 01 •• •• •• 00" } });
  });

  it("sans opérateur choisi, on note celui que Payiz a déduit", async () => {
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ repris: false }) });
    fetchPayiz.mockResolvedValueOnce(reponse(201, payizSql({ latest_attempt: { id: "a", status: "pending", failure_code: null, operator: "moov", phone: null } })));
    faux.repondre("rpc.noter_essai", { data: carteSql({ payiz_id: "pay_1", essai_le: "2026-11-01T10:00:00Z" }) });
    await payer({ ...ENTREE, telephone: "01 55 00 00 00", operateur: null });
    expect(corpsEnvoye().payer).toEqual({ phone: "+2290155000000" });
    expect(faux.de("rpc", "noter_essai")[0].valeurs).toMatchObject({ p_operateur: "moov" });
  });

  it("paiement en cours repris : pas de second appel à Payiz", async () => {
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ repris: true, payiz_id: "pay_1", essai_le: "2026-11-01T10:01:00Z" }) });
    expect(await payer(ENTREE)).toMatchObject({ etat: "attente", finAttente: "2026-11-01T10:04:00.000Z" });
    expect(fetchPayiz).not.toHaveBeenCalled();
    expect(faux.de("rpc", "noter_essai")).toEqual([]);
  });

  it("abonnement offert : réussi sans Payiz, même sans numéro", async () => {
    vi.stubEnv("PAYIZ_CLE_SECRETE", "");
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ statut: "reussi", montant: 0, remise: 15000, numero_recu: "ET-R-2026-000002", repris: false }) });
    expect(await payer({ ...ENTREE, code: "OFFERT", telephone: "" })).toMatchObject({ etat: "reussi", paiement: { numeroRecu: "ET-R-2026-000002" } });
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("numéro vide pour un paiement : message", async () => {
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ repris: false }) });
    expect(await payer({ ...ENTREE, telephone: "" })).toEqual({ etat: "erreur", message: "Saisissez votre numéro Mobile Money." });
  });

  it("erreur Payiz traduite", async () => {
    faux.repondre("rpc.preparer_paiement", { data: carteSql({ repris: false }) });
    fetchPayiz.mockResolvedValueOnce(reponse(422, { error: { code: "operator_required", message: "…" } }));
    expect(await payer(ENTREE)).toEqual({ etat: "erreur", message: "Choisissez votre opérateur, MTN ou Moov." });
    expect(faux.de("rpc", "noter_essai")).toEqual([]);
  });

  it("refus de la base : son message", async () => {
    faux.repondre("rpc.preparer_paiement", { error: { code: "P0001", message: "Ce code a expiré." } });
    expect(await payer({ ...ENTREE, code: "VIEUX" })).toEqual({ etat: "erreur", message: "Ce code a expiré." });
  });
});

describe("Suivre et réessayer", () => {
  it("suivre : réussi chez Payiz, confirmé en base", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ payiz_id: "pay_1", essai_le: "2026-11-01T10:00:00Z" }) });
    fetchPayiz.mockResolvedValueOnce(reponse(200, payizSql({ status: "succeeded" })));
    faux.repondre("rpc.confirmer_paiement", { data: carteSql({ statut: "reussi", payiz_id: "pay_1", numero_recu: "ET-R-2026-000001" }) });
    expect(await suivrePaiement(PAIEMENT_ID)).toMatchObject({ etat: "reussi", paiement: { numeroRecu: "ET-R-2026-000001" } });
    expect(fetchPayiz.mock.calls[0][0]).toBe("https://api.payiz.app/v1/payments/pay_1");
    expect(faux.de("rpc", "confirmer_paiement")[0].valeurs).toEqual({ p_paiement: PAIEMENT_ID, p_payiz: "pay_1", p_montant: 12000, p_jeton: "J" });
  });

  it("suivre : Payiz injoignable, on reste en attente", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ payiz_id: "pay_1", essai_le: "2026-11-01T10:00:00Z" }) });
    fetchPayiz.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await suivrePaiement(PAIEMENT_ID)).toMatchObject({ etat: "attente" });
  });

  it("suivre : paiement introuvable", async () => {
    faux.repondre("rpc.mon_paiement", { data: null });
    expect(await suivrePaiement(PAIEMENT_ID)).toEqual({ etat: "erreur", message: "Paiement introuvable." });
  });

  it("réessayer : nouvelle clé d'idempotence, puis l'attente", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ statut: "echoue", motif_echec: "insufficient_funds", payiz_id: "pay_1" }) });
    fetchPayiz.mockResolvedValueOnce(reponse(201, { object: "payment_attempt" }));
    faux.repondre("rpc.noter_essai", { data: carteSql({ payiz_id: "pay_1", essai_le: "2026-11-01T10:05:00Z" }) });
    expect(await reessayer({ paiementId: PAIEMENT_ID, telephone: "01 42 00 00 00", operateur: "mtn" })).toMatchObject({ etat: "attente" });
    expect(fetchPayiz.mock.calls[0][0]).toBe("https://api.payiz.app/v1/payments/pay_1/attempts");
    expect(entete(0, "Idempotency-Key")).toMatch(new RegExp(`^${PAIEMENT_ID}-\\d+$`));
  });

  it("réessayer : paiement clos chez Payiz, noté expiré", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ statut: "echoue", payiz_id: "pay_1" }) });
    fetchPayiz.mockResolvedValueOnce(reponse(409, { error: { code: "payment_closed", message: "…" } }));
    faux.repondre("rpc.noter_echec", { data: carteSql({ statut: "expire", payiz_id: "pay_1" }) });
    expect(await reessayer({ paiementId: PAIEMENT_ID, telephone: "01 42 00 00 00", operateur: "mtn" })).toMatchObject({ etat: "expire" });
    expect(faux.de("rpc", "noter_echec")[0].valeurs).toEqual({ p_paiement: PAIEMENT_ID, p_statut: "expire", p_motif: null, p_jeton: "J" });
  });
});

describe("Resynchroniser", () => {
  it("seuls les paiements en attente de moins d'une heure, chez Payiz", async () => {
    const recent = new Date(Date.now() - 10 * 60_000).toISOString();
    const ancien = new Date(Date.now() - 2 * 3600_000).toISOString();
    faux.repondre("rpc.mes_paiements", {
      data: [
        carteSql({ payiz_id: "pay_1", essai_le: recent }),
        carteSql({ id: "33333333-3333-4333-8333-333333333333", payiz_id: "pay_2", essai_le: ancien }),
        carteSql({ id: "44444444-4444-4444-8444-444444444444", statut: "reussi", payiz_id: "pay_3", essai_le: recent }),
      ],
    });
    fetchPayiz.mockResolvedValueOnce(reponse(200, payizSql({ status: "succeeded" })));
    faux.repondre("rpc.confirmer_paiement", { data: carteSql({ statut: "reussi" }) });
    await resynchroniserEnAttente();
    expect(fetchPayiz).toHaveBeenCalledTimes(1);
    expect(fetchPayiz.mock.calls[0][0]).toBe("https://api.payiz.app/v1/payments/pay_1");
    expect(faux.de("rpc", "confirmer_paiement").map((a) => (a.valeurs as { p_paiement: string }).p_paiement)).toEqual([PAIEMENT_ID]);
  });

  it("sans configuration : rien", async () => {
    vi.stubEnv("PAIEMENT_JETON", "");
    await resynchroniserEnAttente();
    expect(faux.appels).toEqual([]);
  });
});
