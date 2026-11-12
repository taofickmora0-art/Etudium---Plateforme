import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { lireMoyensDePaiement, lireMoyensRoutes, moyensParMontant, versMoyensDePaiement, viderCacheMoyens } from "@/lib/paiements/moyens";
import { MOYENS_REPLI } from "@/lib/paiements/regles";

// Les moyens de paiement lus chez Payiz (GET /v1/payment_methods, demande du 2 novembre 2026) : les pays, leurs
// opérateurs et le montant à payer ; gardés 5 minutes ; le Bénin avec MTN et Moov si Payiz ne répond pas. Aucune requête
// réelle : `fetch` est simulé.

/** Un moyen tel que Payiz le décrit. */
const moyen = (pays: string, indicatif: string, code: string, nom: string, champs: Record<string, unknown> = {}) => ({
  object: "payment_method",
  country: pays,
  dial_code: indicatif,
  operator: { code, name: nom, logo_url: `https://cdn.payiz.app/operateurs/${code}.png` },
  phone_prefixes: [],
  currency: "XOF",
  min_amount: 1000,
  max_amount: 2_000_000,
  ...champs,
});

const LISTE = {
  object: "list",
  has_more: false,
  url: "/v1/payment_methods",
  data: [
    moyen("TGO", "+228", "togocel", "Mixx by Yas", { phone_prefixes: ["90", "91"], amount_to_pay: 15000, fee: 0 }),
    moyen("BEN", "+229", "mtn", "MTN Mobile Money", { phone_prefixes: ["0142", "0197"], amount_to_pay: 15000, fee: 0 }),
    moyen("BEN", "+229", "moov", "Moov Money", { phone_prefixes: ["0155"], amount_to_pay: 15000, fee: 0 }),
    moyen("BEN", "+229", "celtiis", "Celtiis Cash", { phone_prefixes: [], amount_to_pay: 15000, fee: 0, operator: { code: "celtiis", name: "Celtiis Cash", logo_url: null } }),
    moyen("GHA", "+233", "mtn", "MTN MoMo", { currency: "GHS", amount_to_pay: 32150, min_amount: 100, max_amount: null }),
  ],
};

const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status });
const fetchPayiz = vi.fn<typeof fetch>();

beforeEach(() => {
  viderCacheMoyens();
  fetchPayiz.mockReset();
  fetchPayiz.mockImplementation(async () => reponse(200, LISTE));
  vi.stubEnv("PAYIZ_CLE_SECRETE", "sk_test_x");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("La conversion de payment_methods", () => {
  it("les pays (nom en français, indicatif) et leurs opérateurs, le Bénin d'abord", () => {
    const moyens = versMoyensDePaiement(LISTE);
    expect(moyens?.repli).toBe(false);
    expect(moyens?.pays.map((p) => [p.code, p.nom, p.indicatif])).toEqual([
      ["BEN", "Bénin", "+229"],
      ["GHA", "Ghana", "+233"],
      ["TGO", "Togo", "+228"],
    ]);
    expect(moyens?.pays[0].operateurs).toEqual([
      { code: "mtn", nom: "MTN Mobile Money", logo: "https://cdn.payiz.app/operateurs/mtn.png", prefixes: ["0142", "0197"], devise: "XOF", montantAPayer: 15000, minimum: 1000, maximum: 2_000_000 },
      { code: "moov", nom: "Moov Money", logo: "https://cdn.payiz.app/operateurs/moov.png", prefixes: ["0155"], devise: "XOF", montantAPayer: 15000, minimum: 1000, maximum: 2_000_000 },
      { code: "celtiis", nom: "Celtiis Cash", logo: null, prefixes: [], devise: "XOF", montantAPayer: 15000, minimum: 1000, maximum: 2_000_000 },
    ]);
    expect(moyens?.pays[1].operateurs[0]).toMatchObject({ code: "mtn", nom: "MTN MoMo", devise: "GHS", montantAPayer: 32150, minimum: 100, maximum: null });
  });

  it("ce qui est mal formé est écarté ; un pays inconnu garde son code ; sans montant, le montant à payer est inconnu", () => {
    const moyens = versMoyensDePaiement({
      object: "list",
      data: [
        moyen("BEN", "+229", "MTN BJ", "Code refusé"),
        moyen("BENIN", "+229", "mtn", "Pays mal écrit"),
        moyen("BEN", "229", "mtn", "Indicatif sans +"),
        moyen("BEN", "+229", "mtn", "MTN Mobile Money", { operator: { code: "mtn", name: "MTN Mobile Money", logo_url: "http://cdn.payiz.app/mtn.png" } }),
        moyen("BEN", "+229", "mtn", "En double"),
        moyen("xkx", "+383", "ipko", "", { phone_prefixes: ["044", "x9", 45], currency: "eur" }),
        moyen("SEN", "+221", "wave", "Wave", { currency: "€" }),
        "pas un objet",
      ],
    });
    expect(moyens?.pays.map((p) => [p.code, p.nom, p.indicatif, p.operateurs.map((o) => o.code)])).toEqual([
      ["BEN", "Bénin", "+229", ["mtn"]],
      ["SEN", "Sénégal", "+221", ["wave"]],
      ["XKX", "XKX", "+383", ["ipko"]],
    ]);
    // Pas de logo hors https ; un nom vide prend le code mis en forme ; les codes en minuscules sont relevés ; une
    // monnaie illisible : celle du paiement (XOF).
    expect(moyens?.pays[0].operateurs[0]).toMatchObject({ logo: null, montantAPayer: null });
    expect(moyens?.pays[2].operateurs[0]).toMatchObject({ nom: "Ipko", prefixes: ["044"], devise: "EUR" });
    expect(moyens?.pays[1].operateurs[0]).toMatchObject({ devise: "XOF" });
  });

  it("une liste vide ou une réponse inattendue : rien", () => {
    expect(versMoyensDePaiement({ object: "list", data: [] })).toBeNull();
    expect(versMoyensDePaiement(null)).toBeNull();
    expect(versMoyensDePaiement({ error: "x" })).toBeNull();
  });
});

describe("La lecture chez Payiz", () => {
  it("avec la clé, le montant et la monnaie ; la réponse convertie", async () => {
    const moyens = await lireMoyensDePaiement({ montant: 15000, devise: "XOF" }, fetchPayiz);
    expect(fetchPayiz).toHaveBeenCalledTimes(1);
    const [url, init] = fetchPayiz.mock.calls[0];
    expect(url).toBe("https://api.payiz.app/v1/payment_methods?amount=15000&currency=XOF");
    expect(init?.method).toBe("GET");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer sk_test_x" });
    expect(moyens.repli).toBe(false);
    expect(moyens.pays[0].operateurs.map((o) => o.code)).toEqual(["mtn", "moov", "celtiis"]);
  });

  it("sans montant : la liste seule", async () => {
    await lireMoyensDePaiement({ devise: "XOF" }, fetchPayiz);
    expect(fetchPayiz.mock.calls[0][0]).toBe("https://api.payiz.app/v1/payment_methods?currency=XOF");
  });

  it("gardée 5 minutes par montant : pas de nouvel appel entre-temps, ni pour deux demandes simultanées", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T09:00:00Z") });
    const [a, b] = await Promise.all([lireMoyensDePaiement({ montant: 15000 }, fetchPayiz), lireMoyensDePaiement({ montant: 15000 }, fetchPayiz)]);
    expect(a).toEqual(b);
    expect(fetchPayiz).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-11-03T09:04:59Z"));
    await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz);
    expect(fetchPayiz).toHaveBeenCalledTimes(1);
    // Un autre montant a sa propre lecture.
    await lireMoyensDePaiement({ montant: 9000 }, fetchPayiz);
    expect(fetchPayiz).toHaveBeenCalledTimes(2);
    vi.setSystemTime(new Date("2026-11-03T09:05:01Z"));
    await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz);
    expect(fetchPayiz).toHaveBeenCalledTimes(3);
  });

  it("sans clé : le repli, sans appel", async () => {
    vi.stubEnv("PAYIZ_CLE_SECRETE", "");
    expect(await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz)).toEqual(MOYENS_REPLI);
    expect(fetchPayiz).not.toHaveBeenCalled();
  });

  it("Payiz en erreur, injoignable ou sans moyen : le repli, gardé 30 secondes seulement", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-03T09:00:00Z") });
    fetchPayiz.mockResolvedValueOnce(reponse(500, { error: { code: "internal_error", message: "…" } }));
    expect(await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz)).toEqual(MOYENS_REPLI);
    await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz);
    expect(fetchPayiz).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-11-03T09:00:31Z"));
    expect((await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz)).repli).toBe(false);
    expect(fetchPayiz).toHaveBeenCalledTimes(2);

    fetchPayiz.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await lireMoyensDePaiement({ montant: 9000 }, fetchPayiz)).toEqual(MOYENS_REPLI);
    fetchPayiz.mockResolvedValueOnce(reponse(200, { object: "list", data: [], has_more: false, url: "/v1/payment_methods" }));
    expect(await lireMoyensDePaiement({ montant: 12000 }, fetchPayiz)).toEqual(MOYENS_REPLI);
  });

  it("pour chaque prix des abonnements, une fois chacun", async () => {
    const parMontant = await moyensParMontant([9000, 15000, 15000, null], fetchPayiz);
    expect(Object.keys(parMontant).sort()).toEqual(["15000", "9000"]);
    expect(fetchPayiz.mock.calls.map((c) => c[0])).toEqual([
      "https://api.payiz.app/v1/payment_methods?amount=9000&currency=XOF",
      "https://api.payiz.app/v1/payment_methods?amount=15000&currency=XOF",
    ]);
  });
});

describe("Avec SasPay en secours (12 novembre 2026)", () => {
  const SASPAY_PAYS = { results: [{ id: 1, iso_code: "BJ" }, { id: 2, iso_code: "CI" }] };
  const SASPAY_RESEAUX = {
    results: [
      { country: 1, code: "mtn_bj", name: "MTN", is_active: true },
      { country: 2, code: "wave_ci", name: "Wave CI", is_active: true },
      { country: 2, code: "mtn_ci", name: "MTN CI", is_active: true },
    ],
  };
  let saspayRepond = true;
  let payizRepond = true;
  const appelsSasPay = () => fetchPayiz.mock.calls.filter((c) => String(c[0]).includes("saspay")).length;

  beforeEach(() => {
    saspayRepond = true;
    payizRepond = true;
    vi.stubEnv("SASPAY_CLE_SECRETE", "sk_test_s");
    fetchPayiz.mockImplementation(async (url) => {
      const u = String(url);
      if (u.includes("api.payiz.app")) return payizRepond ? reponse(200, LISTE) : reponse(500, {});
      if (!saspayRepond) return reponse(503, {});
      if (u.endsWith("/countries/")) return reponse(200, SASPAY_PAYS);
      if (u.includes("/networks/")) return reponse(200, SASPAY_RESEAUX);
      return reponse(404, {});
    });
  });

  it("une seule liste : Payiz d'abord, SasPay comble ; le prestataire reste sur le serveur", async () => {
    const { moyens, prestataireDe } = await lireMoyensRoutes({ montant: 15000 }, fetchPayiz);
    expect(moyens.pays.map((p) => [p.code, p.operateurs.map((o) => o.code)])).toEqual([
      ["BEN", ["mtn", "moov", "celtiis"]],
      ["CIV", ["wave_ci", "mtn_ci"]],
      ["GHA", ["mtn"]],
      ["TGO", ["togocel"]],
    ]);
    expect(prestataireDe("CIV", "wave_ci")).toBe("saspay");
    expect(prestataireDe("BEN", "mtn")).toBe("payiz");
    expect(await lireMoyensDePaiement({ montant: 15000 }, fetchPayiz)).toEqual(moyens);
  });

  it("la liste de SasPay ne dépend pas du montant : gardée 1 heure, 10 minutes s'il ne répond pas", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-12T09:00:00Z") });
    await lireMoyensRoutes({ montant: 15000 }, fetchPayiz);
    await lireMoyensRoutes({ montant: 9000 }, fetchPayiz);
    expect(appelsSasPay()).toBe(3); // pays, réseaux, codes de paiement (404 : la table de repli sert)
    vi.setSystemTime(new Date("2026-11-12T10:00:01Z"));
    saspayRepond = false;
    // Muet : la liste de Payiz seule.
    expect((await lireMoyensRoutes({ montant: 15000 }, fetchPayiz)).moyens.pays.map((p) => p.code)).toEqual(["BEN", "GHA", "TGO"]);
    const apres = appelsSasPay();
    saspayRepond = true;
    vi.setSystemTime(new Date("2026-11-12T10:05:00Z"));
    await lireMoyensRoutes({ montant: 15000 }, fetchPayiz);
    expect(appelsSasPay()).toBe(apres);
    vi.setSystemTime(new Date("2026-11-12T10:10:02Z"));
    expect((await lireMoyensRoutes({ montant: 15000 }, fetchPayiz)).moyens.pays.map((p) => p.code)).toContain("CIV");
  });

  it("Payiz muet : SasPay seul ; les deux muets : le repli, chez Payiz", async () => {
    payizRepond = false;
    const seul = await lireMoyensRoutes({ montant: 15000 }, fetchPayiz);
    expect(seul.moyens.repli).toBe(false);
    expect(seul.prestataireDe("BEN", "mtn_bj")).toBe("saspay");
    viderCacheMoyens();
    saspayRepond = false;
    const rien = await lireMoyensRoutes({ montant: 15000 }, fetchPayiz);
    expect(rien.moyens).toEqual(MOYENS_REPLI);
    expect(rien.prestataireDe("BEN", "mtn")).toBe("payiz");
  });
});
