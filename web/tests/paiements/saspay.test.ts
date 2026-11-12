import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  catalogueSasPay,
  ErreurSasPay,
  messageErreurSasPay,
  motifSasPay,
  payerSasPay,
  verdictSasPay,
  verifierSasPay,
  verifierSignatureSasPay,
} from "@/lib/paiements/saspay";

// SasPay, le prestataire de secours (demande du 12 novembre 2026, reprise de flashSMS) : la demande part sur le
// téléphone (« softpay ») ; Wave et Orange Money font valider sur leur page ; Orange Côte d'Ivoire et Orange Burkina
// demandent un code de paiement généré d'avance. Son nom n'apparaît dans aucun message pour l'étudiant.

const f = vi.fn<typeof fetch>();
const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status });
const corps = (i = 0) => JSON.parse(String(f.mock.calls[i][1]?.body));
const entetes = (i = 0) => f.mock.calls[i][1]?.headers as Record<string, string>;

const DEMANDE = {
  paiementId: "11111111-1111-1111-1111-111111111111",
  cleIdempotence: "11111111-1111-1111-1111-111111111111-1",
  montant: 15000,
  description: "Abonnement Étudium Standard (3 mois)",
  pays: "CI",
  reseau: "orange_ci",
  telephone: "+2250700000000",
  client: { email: "awa@exemple.com", prenom: "Awa", nom: "Adjovi" },
  urlRetour: "https://etudium.online/abonnement",
  codePaiement: " 123456 ",
};

beforeEach(() => f.mockReset());

describe("Payer", () => {
  it("envoie la demande au téléphone, avec la clé d'idempotence ; rend la référence préfixée et la page à ouvrir", async () => {
    f.mockResolvedValueOnce(reponse(201, { data: { id: "abc", status: "PENDING", checkout_url: "https://pay.example/abc" } }));
    expect(await payerSasPay("sk_test_s", DEMANDE, f)).toEqual({ ref: "softpay:abc", redirection: "https://pay.example/abc" });
    expect(f.mock.calls[0][0]).toBe("https://api.saspay.me/api/v1/payments/softpay/");
    expect(entetes()).toMatchObject({ Authorization: "Bearer sk_test_s", "Idempotency-Key": DEMANDE.cleIdempotence });
    expect(corps()).toEqual({
      amount: "15000.00",
      currency: "XOF",
      country: "CI",
      network: "orange_ci",
      description: "Abonnement Étudium Standard (3 mois)",
      customer: { email: "awa@exemple.com", first_name: "Awa", last_name: "Adjovi", phone: "+2250700000000" },
      return_url: "https://etudium.online/abonnement",
      metadata: { reference: DEMANDE.paiementId },
      otp: "123456",
    });
  });

  it("un délai dépassé n'est pas un refus : la même demande est renvoyée une fois (même clé, pas de double débit)", async () => {
    f.mockRejectedValueOnce(new DOMException("délai", "TimeoutError")).mockResolvedValueOnce(reponse(201, { id: "abc" }));
    expect(await payerSasPay("sk_test_s", { ...DEMANDE, codePaiement: null }, f)).toEqual({ ref: "softpay:abc", redirection: null });
    expect(entetes(1)["Idempotency-Key"]).toBe(DEMANDE.cleIdempotence);
    expect("otp" in corps(1)).toBe(false);
  });

  it("un refus : son code et son message ; un message pour l'étudiant qui ne nomme pas SasPay", async () => {
    f.mockResolvedValueOnce(reponse(422, { error: { code: "prepayment_otp_missing", message: "OTP required" } }));
    const refus = await payerSasPay("sk_test_s", DEMANDE, f).catch((e: unknown) => e);
    expect(refus).toBeInstanceOf(ErreurSasPay);
    expect(refus).toMatchObject({ code: "prepayment_otp_missing", statut: 422 });
    for (const code of ["prepayment_otp_missing", "invalid_otp", "invalid_customer", "no_route_available", "inconnu"]) expect(messageErreurSasPay(code)).not.toMatch(/saspay/i);
    expect(messageErreurSasPay("prepayment_otp_missing")).toMatch(/code de paiement/);
    expect(messageErreurSasPay("inconnu")).toBe("Le paiement est indisponible pour le moment. Réessayez plus tard.");
  });
});

describe("Lire un paiement", () => {
  it("relit l'état chez SasPay ; réussi, échoué ou en attente", async () => {
    f.mockResolvedValueOnce(reponse(200, { data: { status: "SUCCESS", currency: "XOF", requested_amount: "15000.00" } }));
    const lu = await verifierSasPay("sk_test_s", "softpay:abc", f);
    expect(f.mock.calls[0][0]).toBe("https://api.saspay.me/api/v1/payments/abc/verify/");
    expect(verdictSasPay(lu, 15000)).toEqual({ action: "confirmer", montant: 15000 });
    // Un montant différent est rapporté tel quel : la base le refusera.
    expect(verdictSasPay({ status: "SUCCESS", currency: "XOF", requestedAmount: 9000 }, 15000)).toEqual({ action: "confirmer", montant: 9000 });
    // Hors zone franc, SasPay convertit : c'est notre demande, à notre prix, qui a été payée.
    expect(verdictSasPay({ status: "SUCCESS", currency: "GHS", requestedAmount: 320 }, 15000)).toEqual({ action: "confirmer", montant: 15000 });
    expect(verdictSasPay({ status: "FAILED", currency: "XOF", requestedAmount: 15000 }, 15000)).toEqual({ action: "echec", statut: "echoue", motif: null });
    expect(verdictSasPay({ status: "PENDING", currency: "XOF", requestedAmount: 15000 }, 15000)).toEqual({ action: "attendre" });
    // Les autres fins (revue) : expirée, sautée faute de code, rejetée.
    for (const status of ["EXPIRED", "SKIPPED", "REJECTED"]) expect(verdictSasPay({ status, currency: "XOF", requestedAmount: 15000 }, 15000)).toMatchObject({ action: "echec" });
    expect(verdictSasPay({ status: "PROCESSING", currency: "XOF", requestedAmount: 15000 }, 15000)).toEqual({ action: "attendre" });
  });

  it("le motif d'un échec, d'après la dernière tentative : un code connu d'Étudium", async () => {
    f.mockResolvedValueOnce(
      reponse(200, { attempts: [{ status: "FAILED", error_message: "Insufficient funds", created_at: "2026-11-12T10:00:00Z" }], status_logs: [] }),
    );
    expect(await motifSasPay("sk_test_s", "softpay:abc", f)).toBe("insufficient_funds");
    expect(f.mock.calls[0][0]).toBe("https://api.saspay.me/api/v1/transactions/abc/");
    f.mockResolvedValueOnce(reponse(200, { status_logs: [{ to_status: "FAILED", reason: "Transaction refusée par le client" }] }));
    expect(await motifSasPay("sk_test_s", "softpay:abc", f)).toBe("payer_declined");
    f.mockRejectedValueOnce(new TypeError("réseau"));
    expect(await motifSasPay("sk_test_s", "softpay:abc", f)).toBe("unknown");
  });
});

describe("Le catalogue", () => {
  const PAYS = { results: [{ id: 1, iso_code: "BJ" }, { id: 2, iso_code: "CM" }, { id: 3, iso_code: "BF" }] };
  const RESEAUX = {
    results: [
      { country: 1, code: "mtn_bj", name: "MTN Benin", is_active: true },
      { country: 1, code: "moov_bj", name: "Moov Benin", is_active: false },
      { country: 2, code: "mtn_cm", name: "MTN Cameroon", is_active: true },
      { country: 2, code: "wave_cm", name: "Wave Cameroon", is_active: true },
      { country: 3, code: "orange_bf", name: "Orange Burkina", is_active: true },
    ],
    next: null,
  };
  const repondre = (tarifs: unknown) =>
    f.mockImplementation(async (url) => {
      const u = String(url);
      if (u.endsWith("/countries/")) return reponse(200, PAYS);
      if (u.includes("/networks/")) return reponse(200, RESEAUX);
      if (u.endsWith("/pricing/my-rates/")) return tarifs === null ? reponse(500, {}) : reponse(200, tarifs);
      return reponse(404, {});
    });

  it("ce que SasPay encaisse en ce moment : sans les réseaux coupés, avec ceux qu'il ajoute ; Wave et Orange valident sur leur page", async () => {
    repondre(null);
    const pays = await catalogueSasPay("sk_test_s", f);
    expect(pays?.map((p) => [p.code, p.operateurs.map((o) => [o.code, o.validation ?? "telephone"])])).toEqual([
      ["BEN", [["mtn_bj", "telephone"]]],
      // Orange Burkina demande un code de paiement : la table de repli le sait.
      ["BFA", [["orange_bf", "code"]]],
      ["CMR", [["mtn_cm", "telephone"], ["wave_cm", "page"]]],
    ]);
    const benin = pays![0];
    expect(benin).toMatchObject({ nom: "Bénin", indicatif: "+229" });
    expect(benin.operateurs[0]).toMatchObject({ nom: "MTN MoMo", logo: null, prefixes: [], devise: "XOF", montantAPayer: null });
    expect(pays![1].operateurs[0].consigne).toBe("Composez *144*4*6*{montant}# sur votre téléphone pour obtenir votre code de paiement.");
  });

  it("SasPay dit lui-même quels réseaux demandent un code (et ce qu'il faut composer)", async () => {
    repondre({ data: [{ network_code: "orange_bf", otp_required: false }, { network_code: "mtn_cm", otp_required: true, otp_instructions: "Composez *126#." }] });
    const pays = await catalogueSasPay("sk_test_s", f);
    const tous = pays!.flatMap((p) => p.operateurs);
    expect(tous.find((o) => o.code === "orange_bf")).toMatchObject({ validation: "page" });
    expect(tous.find((o) => o.code === "mtn_cm")).toMatchObject({ validation: "code", consigne: "Composez *126#." });
  });

  it("une consigne qui nommerait SasPay est remplacée (l'étudiant ne le voit jamais)", async () => {
    repondre({ data: [{ network_code: "mtn_cm", otp_required: true, otp_instructions: "Generate your SasPay code" }] });
    const tous = (await catalogueSasPay("sk_test_s", f))!.flatMap((p) => p.operateurs);
    expect(tous.find((o) => o.code === "mtn_cm")?.consigne).not.toMatch(/saspay/i);
  });

  it("SasPay muet : null (il ne propose rien plutôt qu'un pays qu'on ne saurait pas encaisser)", async () => {
    f.mockResolvedValue(reponse(500, {}));
    expect(await catalogueSasPay("sk_test_s", f)).toBeNull();
  });
});

describe("La signature des notifications", () => {
  const secret = "whsec_x";
  const corpsBrut = '{"event":"transaction.success","data":{"id":"abc"}}';
  const signer = (t: number, c = corpsBrut) => createHmac("sha256", secret).update(`${t}.${c}`).digest("hex");
  const maintenant = 1_800_000_000_000;
  const t = maintenant / 1000;

  it("HMAC-SHA256 de « horodatage.corps brut », de moins de 5 minutes", () => {
    expect(verifierSignatureSasPay(corpsBrut, String(t), signer(t), secret, maintenant)).toBe(true);
    expect(verifierSignatureSasPay(corpsBrut, String(t), signer(t).toUpperCase(), secret, maintenant)).toBe(true);
    expect(verifierSignatureSasPay(`${corpsBrut} `, String(t), signer(t), secret, maintenant)).toBe(false);
    expect(verifierSignatureSasPay(corpsBrut, String(t - 301), signer(t - 301), secret, maintenant)).toBe(false);
    expect(verifierSignatureSasPay(corpsBrut, null, signer(t), secret, maintenant)).toBe(false);
    expect(verifierSignatureSasPay(corpsBrut, String(t), "zz", secret, maintenant)).toBe(false);
  });
});
