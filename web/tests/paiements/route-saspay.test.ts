import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { carteSql, PAIEMENT_ID } from "../abonnement/fixtures";
import { jetonServeur } from "@/lib/paiements/config";

// Les notifications de SasPay (12 novembre 2026) : la signature est vérifiée avant toute lecture ; elles ne nomment pas
// notre paiement, elles déclenchent la relecture chez SasPay des paiements SasPay en attente (0081). SasPay relance tant
// qu'il ne reçoit pas de 2xx (5 tentatives).

const JETON = jetonServeur("sk_test_x");
const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const viderFileApres = vi.fn();
vi.mock("@/lib/envois/declencher", () => ({ viderFileApres: () => viderFileApres() }));

const { POST } = await import("@/app/api/paiements/saspay/route");

const SECRET = "whsec_saspay";
const f = vi.fn<typeof fetch>();
const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status });
const CORPS = JSON.stringify({ event: "transaction.success", data: { id: "sp1", status: "SUCCESS" } });
const requete = (corps = CORPS, signature?: string, t = Math.floor(Date.now() / 1000)) =>
  new Request("http://localhost:3000/api/paiements/saspay", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-timestamp": String(t),
      "x-webhook-signature": signature ?? createHmac("sha256", SECRET).update(`${t}.${corps}`).digest("hex"),
    },
    body: corps,
  });

beforeEach(() => {
  faux.vider();
  viderFileApres.mockClear();
  f.mockReset();
  vi.stubGlobal("fetch", f);
  vi.stubEnv("PAYIZ_CLE_SECRETE", "sk_test_x");
  vi.stubEnv("SASPAY_CLE_SECRETE", "sk_test_s");
  vi.stubEnv("SASPAY_SECRET_WEBHOOK", SECRET);
  faux.repondre("rpc.paiements_softpay_en_attente", { data: [{ id: PAIEMENT_ID, ref: "softpay:sp1", montant: 12000 }] });
  faux.repondre("rpc.confirmer_paiement", { data: carteSql({ statut: "reussi", payiz_id: "softpay:sp1" }) });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Route des notifications SasPay", () => {
  it("sans secret de notification : 503", async () => {
    vi.stubEnv("SASPAY_SECRET_WEBHOOK", "");
    expect((await POST(requete())).status).toBe(503);
  });

  it("signature fausse ou trop ancienne : 403, rien n'est lu", async () => {
    expect((await POST(requete(CORPS, "0".repeat(64)))).status).toBe(403);
    const vieux = Math.floor(Date.now() / 1000) - 600;
    expect((await POST(requete(CORPS, undefined, vieux))).status).toBe(403);
    expect(faux.appels).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("une transaction : les paiements SasPay en attente sont relus chez lui et appliqués ; le reçu part", async () => {
    f.mockResolvedValue(reponse(200, { status: "SUCCESS", currency: "XOF", requested_amount: "12000.00" }));
    const r = await POST(requete());
    expect(r.status).toBe(200);
    expect(faux.de("rpc", "paiements_softpay_en_attente")[0].valeurs).toEqual({ p_jeton: JETON });
    expect(f.mock.calls[0][0]).toBe("https://api.saspay.me/api/v1/payments/sp1/verify/");
    expect(faux.de("rpc", "confirmer_paiement")[0].valeurs).toMatchObject({ p_paiement: PAIEMENT_ID, p_payiz: "softpay:sp1", p_montant: 12000 });
    expect(viderFileApres).toHaveBeenCalled();
  });

  it("un autre événement (retrait, test) : reçu, rien à faire", async () => {
    const corps = JSON.stringify({ event: "settlement.success", data: {} });
    expect((await POST(requete(corps))).status).toBe(200);
    expect(faux.appels).toEqual([]);
  });

  it("la base ne répond pas : 500, SasPay relancera", async () => {
    faux.repondre("rpc.paiements_softpay_en_attente", { error: { message: "panne" } });
    expect((await POST(requete())).status).toBe(500);
  });
});

describe("Une relecture qui échoue (revue)", () => {
  it("SasPay injoignable : 500, il relancera ; un refus définitif de la base : 200", async () => {
    f.mockResolvedValue(reponse(503, {}));
    expect((await POST(requete())).status).toBe(500);
    f.mockResolvedValue(reponse(200, { status: "SUCCESS", currency: "XOF", requested_amount: "9000.00" }));
    faux.repondre("rpc.confirmer_paiement", { error: { message: "Montant différent du paiement enregistré." } });
    expect((await POST(requete())).status).toBe(200);
  });
});
