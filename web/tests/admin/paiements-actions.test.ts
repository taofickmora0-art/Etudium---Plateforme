import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCES_EQUIPE } from "@/lib/admin/garde";
import { fauxSupabase } from "./faux-supabase";
import { jetonServeur } from "@/lib/paiements/config";

// Les actions du back-office « Abonnements et paiements » (lot 2, 0051). Le jeton et la clé ne quittent jamais le
// serveur : l'écran ne reçoit que leur état.

const faux = fauxSupabase();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => faux.client }));
const getShellUser = vi.fn();
vi.mock("@/lib/auth/current-user", () => ({ getShellUser: () => getShellUser(), demoModeActive: () => false }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

const actions = await import("@/lib/admin/paiements/actions");
const { lireEtatPaiements } = await import("@/lib/admin/paiements/data");

// Le jeton du serveur, tiré de la clé Payiz de test.
const JETON = jetonServeur("sk_test_cle");
const GUIDE = "Ajoutez PAYIZ_CLE_SECRETE dans web/.env.local (guide « Ce qui te revient », section 56), puis relancez le serveur.";
const ID = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  faux.vider();
  getShellUser.mockResolvedValue({ prenom: "Awa", nom: "K", roles: ["etudiant", "admin"] });
  vi.stubEnv("PAYIZ_CLE_SECRETE", "sk_test_cle");
  vi.stubEnv("PAYIZ_SECRET_WEBHOOK", "");
});
afterEach(() => vi.unstubAllEnvs());

describe("Le réglage « Paiements activés »", () => {
  it("hors équipe : refusé, sans appel", async () => {
    getShellUser.mockResolvedValue({ prenom: "Koffi", nom: "D", roles: ["etudiant"] });
    expect(await actions.activerPaiements()).toEqual({ ok: false, message: ACCES_EQUIPE });
    expect(faux.appels).toEqual([]);
  });

  it("sans la clé Payiz : le guide, sans appel", async () => {
    vi.stubEnv("PAYIZ_CLE_SECRETE", "");
    expect(await actions.activerPaiements()).toEqual({ ok: false, message: GUIDE });
    expect(faux.appels).toEqual([]);
  });

  it("activer envoie le jeton du serveur à la base ; désactiver", async () => {
    expect(await actions.activerPaiements()).toEqual({ ok: true });
    expect(faux.de("rpc", "activer_paiements")[0].valeurs).toEqual({ p_jeton: JETON });
    expect(await actions.desactiverPaiements()).toEqual({ ok: true });
    expect(faux.de("rpc", "desactiver_paiements")).toHaveLength(1);
  });

  it("l'état ne contient jamais la clé ni le jeton", async () => {
    faux.repondre("rpc.etat_paiements", { data: { ouverts: true, jeton_reconnu: true } });
    const etat = await lireEtatPaiements();
    expect(etat).toEqual({ ouverts: true, jeton: "reconnu", cle: "test", webhook: false });
    expect(JSON.stringify(etat)).not.toContain("sk_test_cle");
    expect(JSON.stringify(etat)).not.toContain(JETON);
    faux.repondre("rpc.etat_paiements", { data: { ouverts: true, jeton_reconnu: false } });
    expect((await lireEtatPaiements()).jeton).toBe("non_reconnu");
    vi.stubEnv("PAYIZ_CLE_SECRETE", "");
    faux.repondre("rpc.etat_paiements", { data: { ouverts: false, jeton_reconnu: null } });
    expect(await lireEtatPaiements()).toEqual({ ouverts: false, jeton: "absent", cle: "absente", webhook: false });
  });
});

describe("Formules, codes promo, abonnements", () => {
  it("régler une formule : prix lu sans espaces, vide = non fixé, refus d'une saisie", async () => {
    expect(await actions.reglerFormule({ formuleId: ID, prix: "15 000", recommandee: true, active: true })).toEqual({ ok: true });
    expect(faux.de("rpc", "regler_formule")[0].valeurs).toEqual({ p_formule: ID, p_prix: 15000, p_recommandee: true, p_active: true });
    await actions.reglerFormule({ formuleId: ID, prix: "", recommandee: false, active: false });
    expect(faux.de("rpc", "regler_formule")[1].valeurs).toMatchObject({ p_prix: null, p_active: false });
    expect(await actions.reglerFormule({ formuleId: ID, prix: "15,5", recommandee: false, active: true })).toEqual({
      ok: false,
      message: "Saisissez le prix en FCFA, sans décimales.",
    });
    faux.repondre("rpc.regler_formule", { error: { code: "P0001", message: "Le prix doit être d’au moins 1 000 FCFA." } });
    expect(await actions.reglerFormule({ formuleId: ID, prix: "500", recommandee: false, active: true })).toEqual({
      ok: false,
      message: "Le prix doit être d’au moins 1 000 FCFA.",
    });
  });

  it("enregistrer un code : dates au Bénin (début à 0 h, fin à 23 h 59), limite vide = sans limite", async () => {
    faux.repondre("rpc.enregistrer_code_promo", { data: ID });
    const r = await actions.enregistrerCodePromo({ id: null, code: "promo20", type: "pourcentage", valeur: "20", debut: "2026-11-01", fin: "2026-11-30", limite: "", actif: true });
    expect(r).toEqual({ ok: true });
    expect(faux.de("rpc", "enregistrer_code_promo")[0].valeurs).toEqual({
      p_id: null,
      p_code: "promo20",
      p_type: "pourcentage",
      p_valeur: 20,
      p_debut: "2026-11-01T00:00:00+01:00",
      p_fin: "2026-11-30T23:59:59+01:00",
      p_limite: null,
      p_actif: true,
    });
  });

  it("attribuer un abonnement à la main : montant lu sans espaces, 0 si offert, refus d'une saisie (0054)", async () => {
    faux.repondre("rpc.attribuer_abonnement", { data: { id: ID } });
    const base = { compteId: ID, formuleId: ID, moyen: "mobile_money" as const, montant: "15 000", reference: " MP2611.1234 " };
    expect(await actions.attribuerAbonnement(base)).toEqual({ ok: true });
    expect(faux.de("rpc", "attribuer_abonnement")[0].valeurs).toEqual({
      p_compte: ID,
      p_formule: ID,
      p_moyen: "mobile_money",
      p_montant: 15000,
      p_reference: "MP2611.1234",
    });
    await actions.attribuerAbonnement({ ...base, moyen: "offert", montant: "" });
    expect(faux.de("rpc", "attribuer_abonnement")[1].valeurs).toMatchObject({ p_moyen: "offert", p_montant: 0 });
    expect(await actions.attribuerAbonnement({ ...base, montant: "15,5" })).toEqual({ ok: false, message: "Indiquez le montant reçu, en FCFA, sans décimales." });
    expect(await actions.attribuerAbonnement({ ...base, montant: "" })).toEqual({ ok: false, message: "Indiquez le montant reçu, en FCFA, sans décimales." });
    expect(faux.de("rpc", "attribuer_abonnement")).toHaveLength(2);
  });

  it("résilier : le motif, puis le message de la base (0054)", async () => {
    expect(await actions.resilierAbonnements(ID, " Remboursé ")).toEqual({ ok: true });
    expect(faux.de("rpc", "resilier_abonnements")[0].valeurs).toEqual({ p_compte: ID, p_motif: "Remboursé" });
    faux.repondre("rpc.resilier_abonnements", { error: { code: "P0001", message: "Ce compte n’a pas d’abonnement en cours." } });
    expect(await actions.resilierAbonnements(ID, "Remboursé")).toEqual({ ok: false, message: "Ce compte n’a pas d’abonnement en cours." });
  });

  it("annuler un abonnement : le message de la base", async () => {
    faux.repondre("rpc.annuler_abonnement", { error: { code: "P0001", message: "Indiquez le motif (3 à 300 caractères)." } });
    expect(await actions.annulerAbonnement(ID, "x")).toEqual({ ok: false, message: "Indiquez le motif (3 à 300 caractères)." });
    expect(faux.de("rpc", "annuler_abonnement")[0].valeurs).toEqual({ p_abonnement: ID, p_motif: "x" });
  });

  it("charger les paiements : filtre, recherche, page", async () => {
    faux.repondre("rpc.paiements_equipe", {
      data: {
        total: 1,
        lignes: [
          {
            id: ID,
            cree_le: "2026-11-01T09:00:00Z",
            compte: { id: "c", prenom: "Awa", nom: "Kpadé", email: "awa@exemple.com" },
            formule: { code: "standard", nom: "Standard", duree_mois: 6 },
            montant: 12000,
            statut: "reussi",
            operateur: "mtn",
            telephone_masque: "+229 01 •• •• •• 00",
            numero_recu: "ET-R-2026-000001",
          },
        ],
      },
    });
    const r = await actions.chargerPaiements({ statut: "reussi", recherche: " awa ", page: 2 });
    expect(faux.de("rpc", "paiements_equipe")[0].valeurs).toEqual({ p_statut: "reussi", p_recherche: "awa", p_page: 2 });
    expect(r).toMatchObject({ ok: true, page: { total: 1, lignes: [{ id: ID, compte: { prenom: "Awa" }, formule: { dureeMois: 6 }, numeroRecu: "ET-R-2026-000001" }] } });
  });
});
