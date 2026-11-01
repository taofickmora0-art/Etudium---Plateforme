import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc, type Qui } from "./banc";

// Migration 0054 : les abonnements attribués à la main au back-office (paiement reçu hors plateforme, ou offert) et la
// résiliation. Réservé aux administrateurs ; le modérateur voit.

let banc: Banc;
const A = randomUUID(); // admin
const M = randomUUID(); // modérateur
const E = randomUUID(); // étudiante
const G = randomUUID(); // étudiant
const F = randomUUID(); // formateur
const formules: Record<string, string> = {};

type Carte = {
  id: string;
  statut: string;
  montant: number;
  remise: number;
  prix_initial: number;
  source: string;
  moyen_manuel: string | null;
  reference_manuelle: string | null;
  numero_recu: string | null;
  abonnement: { debut: string; fin: string } | null;
};
const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const attribuer = (qui: string, compte: string, formule: string, moyen: string, montant: number | null, reference: string | null = null) =>
  rpc<Carte>({ id: qui }, "select public.attribuer_abonnement($1, $2, $3, $4, $5) as r", [compte, formule, moyen, montant, reference]);
const resilier = (qui: string, compte: string, motif: string) => rpc<number>({ id: qui }, "select public.resilier_abonnements($1, $2) as r", [compte, motif]);
const abonne = async (compte: string) => (await banc.db.query<{ r: boolean }>("select public.abonne($1) as r", [compte])).rows[0].r;
const notifications = async (compte: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string }>("select titre, texte, lien from public.notifications where destinataire = $1 order by id", [compte])).rows;

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
      "0050_acces_abonnes", "0051_paiements_equipe", "0052_rappels_abonnements", "0053_finitions_paiement", "0054_abonnements_manuels",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[A, ["admin"]], [M, ["moderateur"]], [E, []], [G, []], [F, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.roles set role = 'formateur' where profil_id = $1", [F]);
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
  await banc.db.query("update public.formules set prix_fcfa = 15000 where code = 'standard'");
  await banc.db.query("update public.formules set prix_fcfa = 9000 where code = 'basique'");
});

describe("Attribuer un abonnement à la main", () => {
  it("payé hors plateforme : l'accès s'ouvre, un reçu, la personne est prévenue et le retrouve dans son historique", async () => {
    const p = await attribuer(A, E, formules.standard, "mobile_money", 15000, " MP2611.1234 ");
    expect(p).toMatchObject({ statut: "reussi", montant: 15000, remise: 0, source: "manuel", moyen_manuel: "mobile_money", reference_manuelle: "MP2611.1234" });
    expect(p.numero_recu).toMatch(/^ET-R-\d{4}-\d{6}$/);
    expect(p.abonnement).not.toBeNull();
    expect(await abonne(E)).toBe(true);
    const [notif] = await notifications(E);
    expect(notif).toMatchObject({ titre: "Votre abonnement Standard est actif", lien: "/abonnement" });
    expect(notif.texte).toMatch(/^Jusqu’au \d{1,2}(er)? \S+ \d{4}\.$/);
    expect((await rpc<{ id: string }[]>({ id: E }, "select public.mes_paiements() as r")).map((c) => c.id)).toEqual([p.id]);
    expect(await rpc({ id: E }, "select public.recu($1) as r", [p.numero_recu])).toMatchObject({
      montant: 15000,
      moyen_manuel: "mobile_money",
      reference_manuelle: "MP2611.1234",
    });
  });

  it("s'ajoute à la fin de l'abonnement en cours", async () => {
    const avant = (await banc.db.query<{ fin: string }>("select max(fin) as fin from public.abonnements where profil_id = $1", [E])).rows[0].fin;
    const p = await attribuer(A, E, formules.basique, "especes", 9000);
    expect(new Date(p.abonnement!.debut).getTime()).toBe(new Date(avant).getTime());
  });

  it("offert : 0 FCFA, quel que soit le montant saisi ; un montant libre, même sous 1 000 FCFA", async () => {
    expect(await attribuer(A, G, formules.standard, "offert", 15000)).toMatchObject({ montant: 0, remise: 15000, moyen_manuel: "offert" });
    expect(await attribuer(A, G, formules.basique, "virement", 500)).toMatchObject({ montant: 500, remise: 8500, statut: "reussi" });
  });

  it("les refus", async () => {
    await expect(attribuer(M, E, formules.standard, "especes", 15000)).rejects.toThrow("Réservé aux administrateurs.");
    await expect(attribuer(A, F, formules.standard, "especes", 15000)).rejects.toThrow("Un compte formateur n’a pas d’abonnement.");
    await expect(attribuer(A, E, formules.standard, "cheque", 15000)).rejects.toThrow("Choisissez le moyen de paiement.");
    await expect(attribuer(A, E, formules.standard, "especes", -1)).rejects.toThrow("Indiquez le montant reçu.");
    await expect(attribuer(A, E, formules.standard, "especes", null)).rejects.toThrow("Indiquez le montant reçu.");
    await expect(attribuer(A, randomUUID(), formules.standard, "especes", 15000)).rejects.toThrow("Compte inconnu.");
    await expect(attribuer(A, E, formules.standard, "especes", 15000, "x".repeat(121))).rejects.toThrow("La référence compte 120 caractères au plus.");
  });

  it("au back-office : la liste des paiements montre l'origine", async () => {
    const page = await rpc<{ lignes: { source: string; moyen_manuel: string | null }[] }>({ id: M }, "select public.paiements_equipe(null, '', 1) as r");
    expect(page.lignes.map((l) => l.source)).toContain("manuel");
    expect(page.lignes.some((l) => l.moyen_manuel === "offert")).toBe(true);
  });
});

describe("La fiche d'un compte", () => {
  it("l'état et la liste des abonnements, pour l'équipe", async () => {
    const fiche = await rpc<{ etat: { etat: string; formule: { nom: string } }; abonnements: { source: string; moyen_manuel: string | null; numero_recu: string; annule_le: string | null }[] }>(
      { id: M },
      "select public.abonnements_compte($1) as r",
      [E],
    );
    expect(fiche.etat).toMatchObject({ etat: "actif", formule: { nom: "Standard" } });
    expect(fiche.abonnements).toHaveLength(2);
    expect(fiche.abonnements.every((a) => a.source === "manuel" && a.annule_le === null)).toBe(true);
    await expect(rpc({ id: E }, "select public.abonnements_compte($1) as r", [E])).rejects.toThrow("Réservé à l’équipe.");
    expect(await rpc({ id: M }, "select public.abonnements_compte($1) as r", [randomUUID()])).toMatchObject({ etat: { etat: "gratuit" }, abonnements: [] });
  });
});

describe("Résilier", () => {
  it("un motif, les administrateurs ; tout l'accès s'arrête et la personne est prévenue", async () => {
    await expect(resilier(A, E, "x")).rejects.toThrow("Indiquez le motif (3 à 300 caractères).");
    await expect(resilier(M, E, "Remboursé")).rejects.toThrow("Réservé aux administrateurs.");
    expect(await resilier(A, E, "Remboursé à sa demande")).toBe(2);
    expect(await abonne(E)).toBe(false);
    expect((await notifications(E)).at(-1)).toEqual({ titre: "Votre abonnement a été résilié", texte: "Remboursé à sa demande", lien: "/abonnement" });
    await expect(resilier(A, E, "Encore")).rejects.toThrow("Ce compte n’a pas d’abonnement en cours.");
    expect(await rpc({ id: E }, "select public.mon_abonnement() as r")).toEqual({ etat: "gratuit" });
  });
});
