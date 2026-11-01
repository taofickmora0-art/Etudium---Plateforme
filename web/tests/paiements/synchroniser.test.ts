import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaiementPayiz } from "@/lib/paiements/payiz";
import { appliquerPayiz } from "@/lib/paiements/synchroniser";
import { fauxSupabase } from "../admin/faux-supabase";

// Appliquer en base ce que dit Payiz d'un paiement (relecture ou notification), avec le jeton du serveur.

const CARTE_SQL = {
  id: "p1",
  statut: "reussi",
  formule: { code: "standard", nom: "Standard", duree_mois: 6 },
  prix_initial: 15000,
  remise: 3000,
  montant: 12000,
  code: "PROMO20",
  operateur: "mtn",
  telephone_masque: "+229 01 •• •• •• 00",
  motif_echec: null,
  numero_recu: "ET-R-2026-000001",
  payiz_id: "pay_1",
  cree_le: "2026-11-01T10:00:00Z",
  essai_le: "2026-11-01T10:00:00Z",
  confirme_le: "2026-11-01T10:01:00Z",
  abonnement: { debut: "2026-11-01T10:01:00Z", fin: "2027-05-01T10:01:00Z" },
};
const payiz = (status: string, essai: Partial<NonNullable<PaiementPayiz["latest_attempt"]>> | null = null, reference = "p1"): PaiementPayiz => ({
  id: "pay_1",
  status,
  amount: 12000,
  currency: "XOF",
  reference,
  expires_at: null,
  latest_attempt: essai ? { id: "att_1", status: "pending", failure_code: null, operator: "mtn", phone: null, ...essai } : null,
});
const client = (faux: ReturnType<typeof fauxSupabase>) => faux.client as unknown as SupabaseClient;

describe("appliquerPayiz", () => {
  it("réussi : confirmer_paiement avec le montant de Payiz", async () => {
    const faux = fauxSupabase();
    faux.repondre("rpc.confirmer_paiement", { data: CARTE_SQL });
    const carte = await appliquerPayiz(client(faux), "p1", payiz("succeeded", { status: "succeeded" }), "J");
    expect(faux.appels).toEqual([
      expect.objectContaining({ table: "rpc", op: "confirmer_paiement", valeurs: { p_paiement: "p1", p_payiz: "pay_1", p_montant: 12000, p_jeton: "J" } }),
    ]);
    expect(carte).toMatchObject({ id: "p1", statut: "reussi", numeroRecu: "ET-R-2026-000001", formule: { dureeMois: 6 } });
  });

  it("essai échoué : noter_echec avec le motif", async () => {
    const faux = fauxSupabase();
    faux.repondre("rpc.noter_echec", { data: { ...CARTE_SQL, statut: "echoue", motif_echec: "insufficient_funds", numero_recu: null, abonnement: null } });
    const carte = await appliquerPayiz(client(faux), "p1", payiz("requires_payment", { status: "failed", failure_code: "insufficient_funds" }), "J");
    expect(faux.appels[0]).toMatchObject({ op: "noter_echec", valeurs: { p_paiement: "p1", p_statut: "echoue", p_motif: "insufficient_funds", p_jeton: "J" } });
    expect(carte).toMatchObject({ statut: "echoue", motifEchec: "insufficient_funds" });
  });

  it("encore en cours : rien en base", async () => {
    const faux = fauxSupabase();
    expect(await appliquerPayiz(client(faux), "p1", payiz("processing", { status: "pending" }), "J")).toBeNull();
    expect(faux.appels).toEqual([]);
  });

  it("un paiement d'une autre référence ou d'une autre monnaie est refusé, sans rien appeler", async () => {
    const faux = fauxSupabase();
    await expect(appliquerPayiz(client(faux), "p1", payiz("succeeded", null, "autre"), "J")).rejects.toThrow("Paiement Payiz étranger.");
    await expect(appliquerPayiz(client(faux), "p1", { ...payiz("succeeded"), currency: "EUR" }, "J")).rejects.toThrow("Paiement Payiz étranger.");
    expect(faux.appels).toEqual([]);
  });

  it("un refus de la base remonte", async () => {
    const faux = fauxSupabase();
    faux.repondre("rpc.confirmer_paiement", { error: { code: "P0001", message: "Montant différent du paiement enregistré." } });
    await expect(appliquerPayiz(client(faux), "p1", payiz("succeeded"), "J")).rejects.toThrow("Montant différent du paiement enregistré.");
  });
});
