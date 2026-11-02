import { describe, expect, it, vi } from "vitest";
import { creerPaiementPayiz, ErreurPayiz, lireMoyensPayiz, lirePaiementPayiz, relancerPaiementPayiz } from "@/lib/paiements/payiz";

// Le client Payiz (https://api.payiz.app/v1), avec un fetch injecté.

const PAIEMENT = { id: "pay_1", status: "processing", amount: 12000, currency: "XOF", reference: "p1", expires_at: null, latest_attempt: null };
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- la signature de fetch, pour lire ses appels
const repondre = (status: number, corps: unknown) => vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(corps), { status }));
const FORMULE = { code: "standard" as const, nom: "Standard", dureeMois: 6 };

describe("Le client Payiz", () => {
  it("crée et lance le paiement en un appel", async () => {
    const f = repondre(201, PAIEMENT);
    const avant = Math.floor(Date.now() / 1000);
    const p = await creerPaiementPayiz(
      "sk_test_x",
      { paiementId: "p1", montant: 12000, formule: FORMULE, telephone: "+2290142000000", pays: "BEN", operateur: "mtn" },
      f,
    );
    expect(p).toEqual(PAIEMENT);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.payiz.app/v1/payments");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk_test_x", "Idempotency-Key": "p1", "Content-Type": "application/json" });
    const corps = JSON.parse(String(init?.body));
    expect(corps).toEqual({
      amount: 12000,
      currency: "XOF",
      reference: "p1",
      description: "Abonnement Étudium Standard (6 mois)",
      metadata: { formule: "standard" },
      fees_paid_by: "merchant",
      expires_at: expect.any(Number),
      payer: { phone: "+2290142000000", country: "BEN", operator: "mtn" },
    });
    expect(corps.expires_at).toBeGreaterThanOrEqual(avant + 899);
    expect(corps.expires_at).toBeLessThanOrEqual(avant + 901);
  });

  it("sans opérateur, Payiz le déduit du numéro ; le pays part toujours (Côte d'Ivoire)", async () => {
    const f = repondre(201, PAIEMENT);
    await creerPaiementPayiz(
      "sk_test_x",
      { paiementId: "p1", montant: 9000, formule: { code: "premium", nom: "Premium", dureeMois: 12 }, telephone: "+2250707000000", pays: "CIV", operateur: null },
      f,
    );
    const corps = JSON.parse(String(f.mock.calls[0][1]?.body));
    expect(corps.payer).toEqual({ phone: "+2250707000000", country: "CIV" });
    expect(corps.currency).toBe("XOF");
    expect(corps.description).toBe("Abonnement Étudium Premium (1 an)");
  });

  it("une erreur de Payiz devient ErreurPayiz avec son code", async () => {
    const f = repondre(422, { error: { type: "invalid_request_error", code: "operator_required", message: "…", details: { operators: ["mtn", "moov"] } } });
    const erreur = await creerPaiementPayiz(
      "sk_test_x",
      { paiementId: "p1", montant: 12000, formule: FORMULE, telephone: "+2290142000000", pays: "BEN", operateur: null },
      f,
    ).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurPayiz);
    expect(erreur).toMatchObject({ code: "operator_required", statut: 422, details: { operators: ["mtn", "moov"] } });
  });

  it("Payiz injoignable : code « reseau »", async () => {
    const f = vi.fn(async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    });
    const erreur = await lirePaiementPayiz("sk_test_x", "pay_1", f).catch((e: unknown) => e);
    expect(erreur).toMatchObject({ code: "reseau", statut: 0 });
  });

  it("relance un essai avec sa propre clé d'idempotence, le pays et l'opérateur ; rend l'essai", async () => {
    const essai = { object: "payment_attempt", id: "tnt_1", status: "pending", failure_code: null, operator: "celtiis", phone: "+229 •• 00", country: "BEN" };
    const f = repondre(201, essai);
    expect(await relancerPaiementPayiz("sk_test_x", "pay_1", { telephone: "+2290143000000", pays: "BEN", operateur: "celtiis", cleIdempotence: "p1-123" }, f)).toEqual(
      essai,
    );
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.payiz.app/v1/payments/pay_1/attempts");
    expect(init?.headers).toMatchObject({ "Idempotency-Key": "p1-123" });
    expect(JSON.parse(String(init?.body))).toEqual({ phone: "+2290143000000", country: "BEN", operator: "celtiis" });
    await relancerPaiementPayiz("sk_test_x", "pay_1", { telephone: "+22890123456", pays: "TGO", operateur: null, cleIdempotence: "p1-124" }, f);
    expect(JSON.parse(String(f.mock.calls[1][1]?.body))).toEqual({ phone: "+22890123456", country: "TGO" });
  });

  it("lit les moyens de paiement (GET, sans corps), pour un montant et une monnaie", async () => {
    const f = repondre(200, { object: "list", data: [], has_more: false, url: "/v1/payment_methods" });
    expect(await lireMoyensPayiz("sk_test_x", { montant: 15000, devise: "XOF" }, f)).toEqual({ object: "list", data: [], has_more: false, url: "/v1/payment_methods" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.payiz.app/v1/payment_methods?amount=15000&currency=XOF");
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk_test_x" });
  });

  it("relit un paiement avec un délai plus court si on le demande", async () => {
    const f = vi.fn(
      (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        new Promise<Response>((_, rejeter) => init?.signal?.addEventListener("abort", () => rejeter(new DOMException("délai", "TimeoutError")))),
    );
    const debut = Date.now();
    const erreur = await lirePaiementPayiz("sk_test_x", "pay_1", f, 50).catch((e: unknown) => e);
    expect(erreur).toMatchObject({ code: "reseau" });
    expect(Date.now() - debut).toBeLessThan(2000);
  });

  it("relit un paiement", async () => {
    const f = repondre(200, PAIEMENT);
    expect(await lirePaiementPayiz("sk_test_x", "pay_1", f)).toEqual(PAIEMENT);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.payiz.app/v1/payments/pay_1");
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk_test_x" });
  });
});
