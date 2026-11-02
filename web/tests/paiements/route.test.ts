import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { carteSql, PAIEMENT_ID, payizSql } from "../abonnement/fixtures";
import { jetonServeur } from "@/lib/paiements/config";

// Le jeton du serveur, tiré de la clé Payiz de test.
const JETON = jetonServeur("sk_test_x");

// Les notifications de Payiz (lot 2, spec §3) : signature vérifiée avant toute lecture, dédoublonnage, puis l'état relu
// chez Payiz et appliqué en base. Payiz relance tant qu'il ne reçoit pas de 2xx.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const viderFileApres = vi.fn();
vi.mock("@/lib/envois/declencher", () => ({ viderFileApres: () => viderFileApres() }));

const { POST } = await import("@/app/api/paiements/payiz/route");

const SECRET = "whsec_test";
const fetchPayiz = vi.fn<typeof fetch>();
const evenement = (type = "payment.succeeded", id = "evt_1") =>
  JSON.stringify({ id, type, created: 1, livemode: false, data: { object: payizSql({ status: "succeeded" }) } });
const requete = (corps: string, signature?: string) => {
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", SECRET).update(`${t}.${corps}`).digest("hex");
  return new Request("http://localhost:3000/api/paiements/payiz", {
    method: "POST",
    headers: { "content-type": "application/json", "payiz-signature": signature ?? `t=${t},v1=${v1}` },
    body: corps,
  });
};

beforeEach(() => {
  faux.vider();
  viderFileApres.mockClear();
  fetchPayiz.mockReset();
  vi.stubGlobal("fetch", fetchPayiz);
  vi.stubEnv("PAYIZ_CLE_SECRETE", "sk_test_x");
  vi.stubEnv("PAYIZ_SECRET_WEBHOOK", SECRET);
  faux.repondre("rpc.evenement_payiz_traite", { data: false });
  faux.repondre("rpc.evenement_payiz", { data: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Route des notifications Payiz", () => {
  it("sans secret de notification : 503", async () => {
    vi.stubEnv("PAYIZ_SECRET_WEBHOOK", "");
    expect((await POST(requete(evenement()))).status).toBe(503);
    expect(faux.appels).toEqual([]);
  });

  it("signature fausse : 400, sans rien lire", async () => {
    const reponse = await POST(requete(evenement(), `t=${Math.floor(Date.now() / 1000)},v1=${"0".repeat(64)}`));
    expect(reponse.status).toBe(400);
    expect(await reponse.json()).toEqual({ erreur: "Signature refusée." });
    expect(faux.appels).toEqual([]);
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("paiement réussi : relu chez Payiz, confirmé en base, puis noté traité", async () => {
    fetchPayiz.mockResolvedValueOnce(new Response(JSON.stringify(payizSql({ status: "succeeded" })), { status: 200 }));
    faux.repondre("rpc.confirmer_paiement", { data: carteSql({ statut: "reussi", payiz_id: "pay_1" }) });
    const reponse = await POST(requete(evenement()));
    expect(reponse.status).toBe(200);
    expect(await reponse.json()).toEqual({ recu: true });
    expect(faux.de("rpc", "evenement_payiz_traite")[0].valeurs).toEqual({ p_id: "evt_1", p_jeton: JETON });
    expect(fetchPayiz.mock.calls[0][0]).toBe("https://api.payiz.app/v1/payments/pay_1");
    expect(faux.de("rpc", "confirmer_paiement")[0].valeurs).toEqual({ p_paiement: PAIEMENT_ID, p_payiz: "pay_1", p_montant: 12000, p_jeton: JETON });
    expect(faux.de("rpc", "evenement_payiz")[0].valeurs).toEqual({ p_id: "evt_1", p_jeton: JETON });
    expect(faux.appels.map((a) => a.op)).toEqual(["evenement_payiz_traite", "confirmer_paiement", "evenement_payiz"]);
    expect(viderFileApres).toHaveBeenCalledTimes(1);
  });

  it("notification déjà traitée : 200 sans relire", async () => {
    faux.repondre("rpc.evenement_payiz_traite", { data: true });
    expect((await POST(requete(evenement()))).status).toBe(200);
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("événement sans rapport avec un paiement : ignoré", async () => {
    expect((await POST(requete(evenement("refund.succeeded")))).status).toBe(200);
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("Payiz en panne pendant la relecture : 500, non noté traité, pour que Payiz relance", async () => {
    fetchPayiz.mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "service_unavailable", message: "…" } }), { status: 502 }));
    expect((await POST(requete(evenement()))).status).toBe(500);
    expect(faux.de("rpc", "confirmer_paiement")).toEqual([]);
    expect(faux.de("rpc", "evenement_payiz")).toEqual([]);
  });

  it("un refus définitif de la base (montant différent, paiement inconnu) : 200 et noté traité, Payiz ne relance pas", async () => {
    for (const message of ["Montant différent du paiement enregistré.", "Paiement inconnu.", "Paiement Payiz différent."]) {
      faux.vider();
      faux.repondre("rpc.evenement_payiz_traite", { data: false });
      fetchPayiz.mockResolvedValueOnce(new Response(JSON.stringify(payizSql({ status: "succeeded" })), { status: 200 }));
      faux.repondre("rpc.confirmer_paiement", { error: { code: "P0001", message } });
      expect((await POST(requete(evenement()))).status, message).toBe(200);
      expect(faux.de("rpc", "evenement_payiz"), message).toHaveLength(1);
    }
  });

  it("paiement d'une autre référence : 200, rien n'est activé", async () => {
    fetchPayiz.mockResolvedValueOnce(new Response(JSON.stringify(payizSql({ status: "succeeded", reference: "commande-ailleurs" })), { status: 200 }));
    expect((await POST(requete(evenement()))).status).toBe(200);
    expect(faux.de("rpc", "confirmer_paiement")).toEqual([]);
  });
});
