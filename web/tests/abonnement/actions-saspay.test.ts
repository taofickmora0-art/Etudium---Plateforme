import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fauxSupabase } from "../admin/faux-supabase";
import { carteSql, FORMULE_ID, MOYENS_PAYIZ, PAIEMENT_ID, payizSql } from "./fixtures";
import { viderCacheMoyens } from "@/lib/paiements/moyens";

// SasPay en secours de Payiz (demande du 12 novembre 2026) : un opérateur que Payiz n'encaisse pas part chez SasPay,
// sans que l'étudiant le sache ; Wave et Orange Money font valider sur leur page ; Orange Burkina et Orange Côte d'Ivoire
// demandent un code de paiement. Les paiements SasPay se suivent, se réessaient et se relisent comme ceux de Payiz.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
vi.mock("@/lib/auth/current-user", () => ({
  demoModeActive: () => false,
  getShellUser: async () => ({ prenom: "Awa", nom: "Adjovi", email: "awa@exemple.com" }),
}));
vi.mock("@/lib/envois/declencher", () => ({ viderFileApres: () => undefined }));

const { payer, reessayer, suivrePaiement } = await import("@/lib/abonnement/actions");
const { resynchroniserEnAttente } = await import("@/lib/paiements/synchroniser");

const f = vi.fn<typeof fetch>();
const reponse = (status: number, corps: unknown) => new Response(JSON.stringify(corps), { status });
/** Les appels qui ne lisent pas les listes (moyens de Payiz, pays et réseaux de SasPay, gardés en mémoire). */
const appels = () => f.mock.calls.filter((c) => !/payment_methods|countries|networks|my-rates/.test(String(c[0])));
const softpay = () => appels().filter((c) => String(c[0]).endsWith("/payments/softpay/"));
const corps = (c: Parameters<typeof fetch>) => JSON.parse(String(c[1]?.body));
const cle = (c: Parameters<typeof fetch>) => (c[1]?.headers as Record<string, string>)["Idempotency-Key"];

let repondre: (url: string) => Response | null = () => null;

beforeEach(() => {
  faux.vider();
  viderCacheMoyens();
  f.mockReset();
  repondre = () => null;
  f.mockImplementation(async (url) => {
    const u = String(url);
    const prepare = repondre(u);
    if (prepare) return prepare;
    if (u.includes("/payment_methods")) return reponse(200, MOYENS_PAYIZ);
    if (u.endsWith("/countries/")) return reponse(200, { results: [{ id: 1, iso_code: "CI" }, { id: 2, iso_code: "BF" }, { id: 3, iso_code: "BJ" }, { id: 4, iso_code: "TG" }] });
    if (u.includes("/networks/"))
      return reponse(200, {
        results: [
          { country: 1, code: "wave_ci", name: "Wave", is_active: true },
          { country: 1, code: "mtn_ci", name: "MTN", is_active: true },
          { country: 2, code: "orange_bf", name: "Orange", is_active: true },
          { country: 3, code: "mtn_bj", name: "MTN", is_active: true },
          { country: 4, code: "moov_tg", name: "Moov Togo", is_active: true },
        ],
      });
    return reponse(404, {});
  });
  vi.stubGlobal("fetch", f);
  vi.stubEnv("PAYIZ_CLE_SECRETE", "sk_test_x");
  vi.stubEnv("SASPAY_CLE_SECRETE", "sk_test_s");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://etudium.online");
  faux.repondre("rpc.paiements_prets", { data: true });
  faux.repondre("rpc.preparer_paiement", { data: carteSql() });
  faux.repondre("rpc.noter_essai", ({ valeurs }) => ({ data: carteSql({ payiz_id: (valeurs as { p_payiz: string }).p_payiz, essai_le: new Date().toISOString() }) }));
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ENTREE = { formuleId: FORMULE_ID, code: "", telephone: "07 00 00 00 00", pays: "CIV", operateur: "mtn_ci" };

describe("Payer chez SasPay", () => {
  it("un opérateur que Payiz n'encaisse pas : la demande part chez SasPay, puis noter_essai avec sa référence", async () => {
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(201, { id: "sp1", status: "PENDING" }) : null);
    const etape = await payer(ENTREE);
    expect(etape).toMatchObject({ etat: "attente" });
    expect("redirection" in etape).toBe(false);
    expect(softpay()).toHaveLength(1);
    expect(appels().some((c) => String(c[0]).includes("api.payiz.app/v1/payments"))).toBe(false);
    expect(cle(softpay()[0])).toMatch(new RegExp(`^${PAIEMENT_ID}-[0-9a-f]{16}$`));
    expect(corps(softpay()[0])).toMatchObject({
      amount: "12000.00",
      country: "CI",
      network: "mtn_ci",
      customer: { email: "awa@exemple.com", first_name: "Awa", last_name: "Adjovi", phone: "+2250700000000" },
      return_url: "https://etudium.online/abonnement",
      metadata: { reference: PAIEMENT_ID },
    });
    expect(faux.de("rpc", "noter_essai")[0].valeurs).toMatchObject({
      p_paiement: PAIEMENT_ID,
      p_payiz: "softpay:sp1",
      p_operateur: "mtn_ci",
      p_operateur_nom: "MTN MoMo",
      p_pays: "CIV",
      p_telephone_masque: "+225 •• •• •• •• 00",
    });
  });

  it("Wave : l'étudiant est envoyé sur la page de l'opérateur", async () => {
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(201, { data: { id: "sp2", checkout_url: "https://pay.wave.example/sp2" } }) : null);
    expect(await payer({ ...ENTREE, operateur: "wave_ci" })).toMatchObject({ etat: "attente", redirection: "https://pay.wave.example/sp2" });
  });

  it("un code de paiement exigé (Orange Burkina) : sans lui, un message et rien ne part ; avec lui, il part", async () => {
    const burkina = { ...ENTREE, pays: "BFA", operateur: "orange_bf", telephone: "70 00 00 00" };
    expect(await payer(burkina)).toEqual({ etat: "erreur", message: "Saisissez le code de paiement donné par votre opérateur." });
    expect(softpay()).toHaveLength(0);
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(201, { id: "sp3" }) : null);
    await payer({ ...burkina, codePaiement: "123456" });
    expect(corps(softpay()[0])).toMatchObject({ country: "BF", network: "orange_bf", otp: "123456" });
  });

  it("un refus : en clair, sans le nom de SasPay ; une erreur de compte est notée pour l'équipe, sans le numéro", async () => {
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(422, { error: { code: "invalid_customer", message: "Bad phone" } }) : null);
    expect(await payer(ENTREE)).toEqual({ etat: "erreur", message: "Ce numéro n’est pas valide pour le pays choisi. Vérifiez-le." });
    const journal = vi.spyOn(console, "error").mockImplementation(() => undefined);
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(403, { error: { code: "api_key_scope_forbidden", message: "Scope +2250700000000" } }) : null);
    expect(await payer(ENTREE)).toEqual({ etat: "erreur", message: "Le paiement est indisponible pour le moment. Réessayez plus tard." });
    expect(journal).toHaveBeenCalledWith(expect.stringContaining("api_key_scope_forbidden"));
    expect(String(journal.mock.calls[0][0])).not.toContain("2250700000000");
    journal.mockRestore();
    expect(faux.de("rpc", "noter_essai")).toHaveLength(0);
  });

  it("un opérateur que Payiz encaisse reste chez Payiz, même avec SasPay", async () => {
    repondre = (u) => (u.endsWith("api.payiz.app/v1/payments") ? reponse(201, payizSql()) : null);
    await payer({ ...ENTREE, pays: "BEN", operateur: "mtn", telephone: "01 42 00 00 00" });
    expect(softpay()).toHaveLength(0);
    expect(faux.de("rpc", "noter_essai")[0].valeurs).toMatchObject({ p_payiz: "pay_1", p_pays: "BEN" });
  });

  it("un pays que seul SasPay encaisse, sans opérateur choisi : il faut le choisir", async () => {
    expect(await payer({ ...ENTREE, operateur: null })).toEqual({ etat: "erreur", message: "Choisissez votre opérateur." });
    expect(appels()).toHaveLength(0);
  });
});

describe("Suivre, réessayer, relire", () => {
  it("suivre : réussi chez SasPay, confirmé en base ; échoué, noté avec son motif", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ payiz_id: "softpay:sp1", essai_le: new Date().toISOString() }) });
    faux.repondre("rpc.confirmer_paiement", { data: carteSql({ statut: "reussi", payiz_id: "softpay:sp1" }) });
    repondre = (u) => (u.endsWith("/payments/sp1/verify/") ? reponse(200, { status: "SUCCESS", currency: "XOF", requested_amount: "12000.00" }) : null);
    expect(await suivrePaiement(PAIEMENT_ID)).toMatchObject({ etat: "reussi" });
    expect(faux.de("rpc", "confirmer_paiement")[0].valeurs).toMatchObject({ p_paiement: PAIEMENT_ID, p_payiz: "softpay:sp1", p_montant: 12000 });

    faux.repondre("rpc.noter_echec", { data: carteSql({ statut: "echoue", motif_echec: "insufficient_funds", payiz_id: "softpay:sp1" }) });
    repondre = (u) =>
      u.endsWith("/payments/sp1/verify/")
        ? reponse(200, { status: "FAILED" })
        : u.endsWith("/transactions/sp1/")
          ? reponse(200, { attempts: [{ status: "FAILED", error_message: "Insufficient funds" }] })
          : null;
    expect(await suivrePaiement(PAIEMENT_ID)).toMatchObject({ etat: "echoue" });
    expect(faux.de("rpc", "noter_echec")[0].valeurs).toMatchObject({ p_paiement: PAIEMENT_ID, p_statut: "echoue", p_motif: "insufficient_funds", p_payiz: "softpay:sp1" });
  });

  it("réessayer après un échec chez SasPay : une nouvelle demande, avec une nouvelle clé d'idempotence", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ statut: "echoue", payiz_id: "softpay:sp1", essai_le: new Date().toISOString() }) });
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(201, { id: "sp9" }) : null);
    expect(await reessayer({ paiementId: PAIEMENT_ID, telephone: "07 00 00 00 01", pays: "CIV", operateur: "mtn_ci" })).toMatchObject({ etat: "attente" });
    expect(cle(softpay()[0])).toMatch(new RegExp(`^${PAIEMENT_ID}-[0-9a-f]{16}$`));
    expect(faux.de("rpc", "noter_essai")[0].valeurs).toMatchObject({ p_payiz: "softpay:sp9" });
  });

  it("réessayer chez Payiz après un échec chez SasPay : un nouveau paiement Payiz, même référence, autre clé", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ statut: "echoue", payiz_id: "softpay:sp1", essai_le: new Date().toISOString() }) });
    repondre = (u) => (u.endsWith("api.payiz.app/v1/payments") ? reponse(201, payizSql({ id: "pay_2" })) : null);
    await reessayer({ paiementId: PAIEMENT_ID, telephone: "01 42 00 00 00", pays: "BEN", operateur: "mtn" });
    const creation = appels().find((c) => String(c[0]).endsWith("api.payiz.app/v1/payments"))!;
    expect(corps(creation)).toMatchObject({ reference: PAIEMENT_ID });
    expect(cle(creation)).toMatch(new RegExp(`^${PAIEMENT_ID}-[0-9a-f]{16}$`));
    expect(faux.de("rpc", "noter_essai")[0].valeurs).toMatchObject({ p_payiz: "pay_2" });
  });

  it("réessayer pendant qu'une demande SasPay attend encore : pas de seconde demande", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ payiz_id: "softpay:sp1", essai_le: new Date().toISOString() }) });
    repondre = (u) => (u.endsWith("/payments/sp1/verify/") ? reponse(200, { status: "PENDING" }) : null);
    expect(await reessayer({ paiementId: PAIEMENT_ID, telephone: "07 00 00 00 01", pays: "CIV", operateur: "mtn_ci" })).toEqual({
      etat: "erreur",
      message: "Une demande est déjà en attente sur votre téléphone. Validez-la ou attendez quelques minutes.",
    });
    expect(softpay()).toHaveLength(0);
  });

  it("resynchroniser : les paiements SasPay en attente sont relus chez SasPay", async () => {
    faux.repondre("rpc.mes_paiements", { data: [carteSql({ payiz_id: "softpay:sp1", essai_le: new Date().toISOString() })] });
    faux.repondre("rpc.confirmer_paiement", { data: carteSql({ statut: "reussi" }) });
    repondre = (u) => (u.endsWith("/payments/sp1/verify/") ? reponse(200, { status: "SUCCESS", currency: "XOF", requested_amount: 12000 }) : null);
    await resynchroniserEnAttente();
    expect(faux.de("rpc", "confirmer_paiement")).toHaveLength(1);
  });
});

describe("Les corrections de la revue", () => {
  it("un paiement expiré ou annulé ne repart pas : rien n'est envoyé", async () => {
    faux.repondre("rpc.mon_paiement", { data: carteSql({ statut: "expire", payiz_id: "softpay:sp1", essai_le: new Date().toISOString() }) });
    expect(await reessayer({ paiementId: PAIEMENT_ID, telephone: "07 00 00 00 01", pays: "CIV", operateur: "mtn_ci" })).toMatchObject({ etat: "expire" });
    expect(appels()).toHaveLength(0);
  });

  it("une même demande garde sa clé (double clic, deux onglets : un seul débit) ; une autre demande en change", async () => {
    repondre = (u) => (u.endsWith("/payments/softpay/") ? reponse(201, { id: "sp1" }) : null);
    await Promise.all([payer(ENTREE), payer(ENTREE)]);
    expect(cle(softpay()[0])).toBe(cle(softpay()[1]));
    await payer({ ...ENTREE, telephone: "07 00 00 00 09" });
    expect(cle(softpay()[2])).not.toBe(cle(softpay()[0]));
    // Deux réessais simultanés du même essai échoué : la même clé.
    faux.repondre("rpc.mon_paiement", { data: carteSql({ statut: "echoue", payiz_id: "softpay:sp1", essai_le: new Date().toISOString() }) });
    const r = { paiementId: PAIEMENT_ID, telephone: "07 00 00 00 01", pays: "CIV", operateur: "mtn_ci" };
    await Promise.all([reessayer(r), reessayer(r)]);
    expect(cle(softpay()[3])).toBe(cle(softpay()[4]));
  });

  it("SasPay ne répond pas à temps : la demande est peut-être partie, l'étudiant le sait", async () => {
    repondre = (u) => {
      if (u.endsWith("/payments/softpay/")) throw new DOMException("délai", "TimeoutError");
      return null;
    };
    expect(await payer(ENTREE)).toEqual({
      etat: "erreur",
      message: "La demande a peut-être été envoyée sur votre téléphone : validez-la si elle est arrivée, puis cliquez de nouveau sur « Payer ».",
    });
  });

  it("un pays où les deux encaissent, sans opérateur choisi : il faut le choisir (sinon ceux d'un seul seraient proposés)", async () => {
    expect(await payer({ ...ENTREE, pays: "TGO", telephone: "80 00 00 00", operateur: null })).toEqual({ etat: "erreur", message: "Choisissez votre opérateur." });
    expect(appels()).toHaveLength(0);
  });
});
