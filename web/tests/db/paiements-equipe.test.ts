import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, MIGRATIONS_LOT_0, type Banc, type Qui } from "./banc";

// Migration 0051 (lot 2) : le back-office des abonnements et des paiements. L'équipe lit tout ; seuls les
// administrateurs touchent à l'argent (prix, codes promo, annulation d'un abonnement).

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
const M = randomUUID(); // modérateur
const E = randomUUID(); // étudiante
const G = randomUUID(); // étudiant
const formules: Record<string, string> = {};

const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const regler = (qui: string, formule: string, prix: number | null, recommandee = false, active = true) =>
  banc.en({ id: qui }, "select public.regler_formule($1, $2, $3, $4)", [formule, prix, recommandee, active]);
const enregistrer = (qui: string, champs: { id?: string | null; code: string; type?: string; valeur: number; debut?: string | null; fin?: string | null; limite?: number | null; actif?: boolean }) =>
  rpc<string>({ id: qui }, "select public.enregistrer_code_promo($1, $2, $3, $4, $5, $6, $7, $8) as r", [
    champs.id ?? null,
    champs.code,
    champs.type ?? "pourcentage",
    champs.valeur,
    champs.debut ?? null,
    champs.fin ?? null,
    champs.limite ?? null,
    champs.actif ?? true,
  ]);
const paiement = async (profil: string, champs: Record<string, unknown>) => {
  const colonnes = { profil_id: profil, formule_id: formules.standard, prix_initial: 15000, montant: 15000, ...champs };
  const noms = Object.keys(colonnes);
  const { rows } = await banc.db.query<{ id: string }>(
    `insert into public.paiements (${noms.join(", ")}) values (${noms.map((_, i) => `$${i + 1}`).join(", ")}) returning id`,
    Object.values(colonnes),
  );
  return rows[0].id;
};

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie", "0036_formateur_sans_espace_etudiant", "0037_reponses_aux_reponses", "0038_photos_communaute", "0039_annonce_masquable",
      "0040_photos_colonne_communaute", "0041_notifications_communaute", "0042_nouvelles_publications", "0043_nouvelles_publications_siennes",
      "0044_temps_reel", "0045_sessions_fuseaux", "0046_replays", "0047_sans_achat_seul", "0048_monetisation", "0049_abonnements_paiements",
      "0050_acces_abonnes", "0051_paiements_equipe",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [M, ["moderateur"]], [E, []], [G, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
});

describe("Les formules", () => {
  it("un modérateur ne règle pas un prix ; un administrateur, si", async () => {
    await expect(regler(M, formules.standard, 15000, true)).rejects.toThrow("Réservé aux administrateurs.");
    await regler(A, formules.standard, 15000, true);
    const { rows } = await banc.db.query<{ prix_fcfa: number }>("select prix_fcfa from public.formules where id = $1", [formules.standard]);
    expect(rows[0].prix_fcfa).toBe(15000);
  });

  it("un prix d'au moins 1 000 FCFA, ou vide", async () => {
    await expect(regler(A, formules.basique, 500)).rejects.toThrow("Le prix doit être d’au moins 1 000 FCFA.");
    await regler(A, formules.basique, null);
  });

  it("une seule formule recommandée", async () => {
    await regler(A, formules.premium, 25000, true);
    const { rows } = await banc.db.query<{ code: string }>("select code from public.formules where recommandee order by code");
    expect(rows.map((r) => r.code)).toEqual(["premium"]);
    await regler(A, formules.standard, 15000, true);
  });
});

describe("Les codes promo", () => {
  it("créer, en majuscules ; modifier ; seuls les administrateurs", async () => {
    const id = await enregistrer(A, { code: " promo20 ", valeur: 20, limite: 50 });
    expect((await banc.db.query<{ code: string }>("select code from public.codes_promo where id = $1", [id])).rows[0].code).toBe("PROMO20");
    expect(await enregistrer(A, { id, code: "PROMO20", valeur: 25, limite: 50 })).toBe(id);
    expect((await banc.db.query<{ valeur: number }>("select valeur from public.codes_promo where id = $1", [id])).rows[0].valeur).toBe(25);
    await expect(enregistrer(M, { code: "AUTRE", valeur: 10 })).rejects.toThrow("Réservé aux administrateurs.");
  });

  it("les messages de saisie", async () => {
    await expect(enregistrer(A, { code: "ab", valeur: 10 })).rejects.toThrow("Le code compte 3 à 30 lettres, chiffres, tirets ou soulignés.");
    await expect(enregistrer(A, { code: "TROP", valeur: 150 })).rejects.toThrow("Un pourcentage va de 1 à 100.");
    await expect(enregistrer(A, { code: "RIEN", type: "montant", valeur: 0 })).rejects.toThrow("Le montant de la remise doit être positif.");
    await expect(enregistrer(A, { code: "DATES", valeur: 10, debut: "2026-12-01", fin: "2026-11-01" })).rejects.toThrow("La fin doit suivre le début.");
    await expect(enregistrer(A, { code: "promo20", valeur: 10 })).rejects.toThrow("Ce code existe déjà.");
  });

  it("l'équipe lit les codes et leurs utilisations (paiements réussis seulement)", async () => {
    const id = await enregistrer(A, { code: "COMPTE", type: "montant", valeur: 2000 });
    await paiement(E, { code_promo_id: id, statut: "reussi", payiz_id: "pay_c1", remise: 2000, montant: 13000 });
    await paiement(G, { code_promo_id: id, statut: "echoue", payiz_id: "pay_c2", remise: 2000, montant: 13000 });
    const codes = await rpc<{ code: string; utilisations: number; type: string; valeur: number }[]>({ id: M }, "select public.codes_promo_equipe() as r");
    expect(codes.find((c) => c.code === "COMPTE")).toMatchObject({ type: "montant", valeur: 2000, utilisations: 1 });
    await expect(rpc({ id: E }, "select public.codes_promo_equipe() as r")).rejects.toThrow("Réservé à l’équipe.");
  });
});

describe("Les paiements", () => {
  it("filtrés par état, cherchés par compte ou numéro de reçu ; les paiements jamais envoyés n'y sont pas", async () => {
    await banc.db.query("delete from public.paiements");
    await paiement(E, { statut: "reussi", payiz_id: "pay_1", numero_recu: "ET-R-2026-000010", operateur: "mtn" });
    await paiement(G, { statut: "echoue", payiz_id: "pay_2", motif_echec: "insufficient_funds" });
    await paiement(G, { statut: "en_attente" });
    await paiement(E, { statut: "expire", payiz_id: "pay_3" });
    await paiement(E, { statut: "annule", payiz_id: "pay_4" });
    type Liste = { total: number; lignes: { statut: string; numero_recu: string | null; compte: { email: string }; formule: { code: string } }[] };
    const lister = (statut: string | null, recherche = "", page = 1) =>
      rpc<Liste>({ id: M }, "select public.paiements_equipe($1, $2, $3) as r", [statut, recherche, page]);
    expect((await lister(null)).total).toBe(4);
    expect((await lister("reussi")).lignes.map((l) => l.numero_recu)).toEqual(["ET-R-2026-000010"]);
    expect((await lister("expire")).total).toBe(2);
    expect((await lister("echoue")).total).toBe(1);
    expect((await lister(null, "et-r-2026-000010")).total).toBe(1);
    const parAdresse = await lister(null, E.slice(0, 8));
    expect(parAdresse.total).toBe(3);
    expect(parAdresse.lignes[0]).toMatchObject({ compte: { email: `${E.slice(0, 8)}@exemple.com` }, formule: { code: "standard" } });
    expect((await lister(null, "", 2)).lignes).toEqual([]);
    await expect(rpc({ id: E }, "select public.paiements_equipe(null, '', 1) as r")).rejects.toThrow("Réservé à l’équipe.");
  });

  it("le détail d'un paiement, avec son abonnement", async () => {
    await abonner(banc, G);
    const { rows } = await banc.db.query<{ id: string }>("select paiement_id as id from public.abonnements where profil_id = $1", [G]);
    const detail = await rpc<{ id: string; statut: string; compte: { id: string }; abonnement: { id: string; annule_le: string | null } }>(
      { id: M },
      "select public.paiement_equipe($1) as r",
      [rows[0].id],
    );
    expect(detail).toMatchObject({ id: rows[0].id, statut: "reussi", compte: { id: G }, abonnement: { annule_le: null } });
    await expect(rpc({ id: E }, "select public.paiement_equipe($1) as r", [rows[0].id])).rejects.toThrow("Réservé à l’équipe.");
  });

  it("annuler un abonnement : un motif, les administrateurs, et le compte est prévenu", async () => {
    const abonnement = await abonner(banc, E);
    const annuler = (qui: string, motif: string) => banc.en({ id: qui }, "select public.annuler_abonnement($1, $2)", [abonnement, motif]);
    await expect(annuler(A, "x")).rejects.toThrow("Indiquez le motif (3 à 300 caractères).");
    await expect(annuler(M, "Remboursé depuis Payiz")).rejects.toThrow("Réservé aux administrateurs.");
    await annuler(A, "Remboursé depuis Payiz");
    expect((await banc.db.query<{ r: boolean }>("select public.abonne($1) as r", [E])).rows[0].r).toBe(false);
    const { rows } = await banc.db.query<{ categorie: string; titre: string; lien: string }>(
      "select categorie, titre, lien from public.notifications where destinataire = $1 order by cree_le desc limit 1",
      [E],
    );
    expect(rows[0]).toEqual({ categorie: "service", titre: "Votre abonnement a été annulé", lien: "/abonnement" });
  });

  it("le tableau de bord : abonnés, chiffre d'affaires, revenus par formule ; la formule de chaque compte", async () => {
    await banc.db.query("delete from public.abonnements");
    await banc.db.query("delete from public.paiements");
    const maintenant = new Date().toISOString();
    await paiement(E, { statut: "reussi", payiz_id: "pay_s1", montant: 15000, confirme_le: maintenant });
    await paiement(G, { statut: "reussi", payiz_id: "pay_s2", formule_id: formules.basique, prix_initial: 9000, montant: 9000, confirme_le: "2026-08-15T10:00:00Z" });
    const abonnement = await abonner(banc, E, { formule: "standard" });
    void abonnement;
    const stats = await rpc<Record<string, unknown>>({ id: M }, "select public.statistiques_back_office() as r");
    expect(stats).toMatchObject({ abonnes_actifs: 1, ca_mois: 30000, ca_total: 39000 });
    expect(stats.etudiants).toBe(2);
    const parMois = stats.ca_par_mois as { mois: string; montant: number }[];
    expect(parMois).toHaveLength(6);
    expect(parMois.at(-1)).toEqual({ mois: maintenant.slice(0, 7), montant: 30000 });
    expect(stats.revenus_par_formule).toEqual([
      { code: "basique", nom: "Basique", montant: 9000, nombre: 1 },
      { code: "standard", nom: "Standard", montant: 30000, nombre: 2 },
      { code: "premium", nom: "Premium", montant: 0, nombre: 0 },
    ]);
    const comptes = await rpc<{ comptes: { id: string; formule: string | null }[] }>({ id: M }, "select public.comptes_equipe('', 'tous', 1) as r");
    expect(comptes.comptes.find((c) => c.id === E)?.formule).toBe("Standard");
    expect(comptes.comptes.find((c) => c.id === G)?.formule).toBeNull();
  });

  it("le résumé du mois", async () => {
    await banc.db.query("delete from public.abonnements");
    await banc.db.query("delete from public.paiements");
    await paiement(E, { statut: "reussi", payiz_id: "pay_r1", montant: 12000, confirme_le: new Date().toISOString() });
    await paiement(G, { statut: "reussi", payiz_id: "pay_r2", montant: 9000, confirme_le: "2026-01-15T10:00:00Z" });
    await paiement(G, { statut: "echoue", payiz_id: "pay_r3" });
    await abonner(banc, E);
    const resume = await rpc<Record<string, number>>({ id: M }, "select public.resume_paiements() as r");
    // L'abonnement d'E vient avec son propre paiement réussi de 15 000 FCFA (aide de test).
    expect(resume).toEqual({ revenus_mois: 27000, reussis_mois: 2, echoues_mois: 1, abonnes_actifs: 1 });
  });
});
