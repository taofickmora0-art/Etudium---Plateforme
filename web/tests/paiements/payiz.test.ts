import { describe, expect, it, vi } from "vitest";
import { creerPaiementPayiz, ErreurPayiz, lirePaiementPayiz, relancerPaiementPayiz } from "@/lib/paiements/payiz";

// Le client Payiz (https://api.payiz.app/v1), avec un fetch injecté.

const PAIEMENT = { id: "pay_1", status: "processing", amount: 12000, currency: "XOF", reference: "p1", expires_at: null, latest_attempt: null };
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- la signature de fetch, pour lire ses appels
const repondre = (status: number, corps: unknown) => vi.fn(async (..._args: Parameters<typeof fetch>) => new Response(JSON.stringify(corps), { status }));
const FORMULE = { code: "standard" as const, nom: "Standard", dureeMois: 6 };

describe("Le client Payiz", () => {
  it("crée et lance le paiement en un appel", async () => {
    const f = repondre(201, PAIEMENT);
    const avant = Math.floor(Date.now() / 1000);
    const p = await creerPaiementPayiz("sk_test_x", { paiementId: "p1", montant: 12000, formule: FORMULE, telephone: "+2290142000000", operateur: "mtn" }, f);
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
      payer: { phone: "+2290142000000", operator: "mtn" },
    });
    expect(corps.expires_at).toBeGreaterThanOrEqual(avant + 899);
    expect(corps.expires_at).toBeLessThanOrEqual(avant + 901);
  });

  it("sans opérateur, Payiz le déduit du numéro", async () => {
    const f = repondre(201, PAIEMENT);
    await creerPaiementPayiz(
      "sk_test_x",
      { paiementId: "p1", montant: 9000, formule: { code: "premium", nom: "Premium", dureeMois: 12 }, telephone: "+2290142000000", operateur: null },
      f,
    );
    const corps = JSON.parse(String(f.mock.calls[0][1]?.body));
    expect(corps.payer).toEqual({ phone: "+2290142000000" });
    expect(corps.description).toBe("Abonnement Étudium Premium (1 an)");
  });

  it("une erreur de Payiz devient ErreurPayiz avec son code", async () => {
    const f = repondre(422, { error: { type: "invalid_request_error", code: "operator_required", message: "…", details: { operators: ["mtn", "moov"] } } });
    const erreur = await creerPaiementPayiz("sk_test_x", { paiementId: "p1", montant: 12000, formule: FORMULE, telephone: "+2290142000000", operateur: null }, f).catch(
      (e: unknown) => e,
    );
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

  it("relance un essai avec sa propre clé d'idempotence", async () => {
    const f = repondre(201, {});
    await relancerPaiementPayiz("sk_test_x", "pay_1", { telephone: "+2290155000000", operateur: "moov", cleIdempotence: "p1-123" }, f);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://api.payiz.app/v1/payments/pay_1/attempts");
    expect(init?.headers).toMatchObject({ "Idempotency-Key": "p1-123" });
    expect(JSON.parse(String(init?.body))).toEqual({ phone: "+2290155000000", operator: "moov" });
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
