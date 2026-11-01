import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc, type Qui } from "./banc";

// Migration 0049 (lot 2) : les formules, les codes promo, les paiements et les abonnements. L'étudiant prépare un
// paiement ; seul le serveur, muni du jeton dont la base ne garde que l'empreinte, note un essai, le confirme ou l'échec.

let banc: Banc;
const S = randomUUID(); // super admin
const E = randomUUID(); // étudiante
const G = randomUUID(); // étudiant
const F = randomUUID(); // formateur
const J = "j".repeat(40); // le jeton du serveur (PAIEMENT_JETON)
const formules: Record<string, string> = {};
let initiales: { code: string; nom: string; duree_mois: number; prix_fcfa: number | null; recommandee: boolean }[];
let codeUnique: string;

type Carte = {
  id: string;
  statut: string;
  montant: number;
  prix_initial: number;
  remise: number;
  code: string | null;
  motif_echec: string | null;
  numero_recu: string | null;
  repris?: boolean;
  formule: { code: string; nom: string; duree_mois: number };
  abonnement: { debut: string; fin: string } | null;
};

const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const essayer = (qui: string, code: string, formule: string) => rpc<Record<string, unknown>>({ id: qui }, "select public.essayer_code($1, $2) as r", [code, formule]);
const preparer = (qui: string, formule: string, code: string | null) => rpc<Carte>({ id: qui }, "select public.preparer_paiement($1, $2) as r", [formule, code]);
const noterEssai = (paiement: string, payiz: string) =>
  rpc<Carte>("anon", "select public.noter_essai($1, $2, 'mtn', '+229 01 •• •• •• 00', $3) as r", [paiement, payiz, J]);
const confirmer = (qui: Qui, paiement: string, payiz: string, montant: number, jeton = J) =>
  rpc<Carte>(qui, "select public.confirmer_paiement($1, $2, $3, $4) as r", [paiement, payiz, montant, jeton]);
const noterEchec = (paiement: string, statut: string, motif: string | null) =>
  rpc<Carte>("anon", "select public.noter_echec($1, $2, $3, $4) as r", [paiement, statut, motif, J]);
const empreinte = (jeton: string | null) =>
  banc.db.query(
    "update public.reglages_paiement set ouverts = $1::text is not null, empreinte = case when $1::text is null then null else encode(sha256(convert_to($1::text, 'UTF8')), 'hex') end",
    [jeton],
  );

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
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [E, []], [G, []], [F, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);

  initiales = await banc.en("anon", "select code, nom, duree_mois, prix_fcfa, recommandee from public.formules order by ordre");
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
  await banc.db.query("update public.formules set prix_fcfa = 15000 where code = 'standard'");
  await banc.db.query("update public.formules set prix_fcfa = 9000 where code = 'basique'");

  await banc.db.query(`insert into public.codes_promo (code, type, valeur, debut, fin, limite, actif) values
    ('PROMO20', 'pourcentage', 20, null, null, null, true),
    ('VIEUX', 'pourcentage', 10, null, now() - interval '1 day', null, true),
    ('FUTUR', 'pourcentage', 10, now() + interval '1 day', null, null, true),
    ('UNIQUE', 'montant', 1000, null, null, 1, true),
    ('DEJA', 'montant', 1000, null, null, null, true),
    ('INACTIF', 'pourcentage', 10, null, null, null, false),
    ('GROS', 'montant', 14500, null, null, null, true),
    ('OFFERT', 'pourcentage', 100, null, null, null, true)`);
  codeUnique = (await banc.db.query<{ id: string }>("select id from public.codes_promo where code = 'UNIQUE'")).rows[0].id;
  // UNIQUE a déjà servi une fois (par G), et sa limite est 1.
  await banc.db.query(
    `insert into public.paiements (profil_id, formule_id, code_promo_id, prix_initial, remise, montant, statut, payiz_id, numero_recu)
     values ($1, $2, $3, 15000, 1000, 14000, 'reussi', 'pay_g', 'ET-R-2026-G')`,
    [G, formules.standard, codeUnique],
  );
});

beforeEach(async () => {
  await banc.db.query("delete from public.abonnements");
  await banc.db.query("delete from public.paiements where code_promo_id is distinct from $1", [codeUnique]);
  await empreinte(J);
});

describe("Formules et codes promo", () => {
  it("trois formules sans prix, lisibles par un visiteur", () => {
    expect(initiales).toEqual([
      { code: "basique", nom: "Basique", duree_mois: 3, prix_fcfa: null, recommandee: false },
      { code: "standard", nom: "Standard", duree_mois: 6, prix_fcfa: null, recommandee: true },
      { code: "premium", nom: "Premium", duree_mois: 12, prix_fcfa: null, recommandee: false },
    ]);
  });

  it("un code s'essaie avec ses messages", async () => {
    expect(await essayer(E, "PROMO20", formules.standard)).toEqual({ ok: true, code_id: expect.any(String), prix_initial: 15000, remise: 3000, montant: 12000 });
    expect(await essayer(E, " promo20 ", formules.standard)).toMatchObject({ ok: true, montant: 12000 });
    const refus = async (code: string, formule = formules.standard) => ((await essayer(E, code, formule)) as { message?: string }).message;
    expect(await refus("PROMO20", formules.premium)).toBe("Cet abonnement n’est pas encore proposé.");
    expect(await refus("INCONNU")).toBe("Ce code n’existe pas.");
    expect(await refus("INACTIF")).toBe("Ce code n’existe pas.");
    expect(await refus("FUTUR")).toBe("Ce code n’est pas encore valable.");
    expect(await refus("VIEUX")).toBe("Ce code a expiré.");
    expect(await refus("UNIQUE")).toBe("Ce code a atteint sa limite.");
    expect(await refus("GROS")).toBe("Ce code ne s’applique pas à cet abonnement.");
    await banc.db.query(
      `insert into public.paiements (profil_id, formule_id, code_promo_id, prix_initial, remise, montant, statut, payiz_id)
       select $1, $2, id, 15000, 1000, 14000, 'reussi', 'pay_deja' from public.codes_promo where code = 'DEJA'`,
      [E, formules.standard],
    );
    expect(await refus("DEJA")).toBe("Vous avez déjà utilisé ce code.");
  });
});

describe("Préparer, noter, confirmer", () => {
  it("préparer : fermé tant que les paiements ne sont pas activés, puis en cours repris", async () => {
    await empreinte(null);
    await expect(preparer(E, formules.standard, "PROMO20")).rejects.toThrow("Les paiements ouvrent bientôt.");
    await expect(banc.en({ id: S }, "select public.activer_paiements('court')")).rejects.toThrow("Le jeton de paiement doit compter au moins 32 caractères.");
    await expect(banc.en({ id: E }, "select public.activer_paiements($1)", [J])).rejects.toThrow("Réservé aux administrateurs.");
    await banc.en({ id: S }, "select public.activer_paiements($1)", [J]);
    expect(await rpc<boolean>("anon", "select public.paiements_ouverts() as r")).toBe(true);

    const p = await preparer(E, formules.standard, "PROMO20");
    expect(p).toMatchObject({
      statut: "en_attente",
      prix_initial: 15000,
      remise: 3000,
      montant: 12000,
      code: "PROMO20",
      repris: false,
      formule: { code: "standard", nom: "Standard", duree_mois: 6 },
      abonnement: null,
    });
    await noterEssai(p.id, "pay_1");
    expect(await preparer(E, formules.basique, null)).toMatchObject({ id: p.id, repris: true });
  });

  it("l'empreinte seule est gardée, illisible des comptes", async () => {
    await banc.en({ id: S }, "select public.activer_paiements($1)", [J]);
    const { rows } = await banc.db.query<{ empreinte: string; attendue: string }>(
      "select empreinte, encode(sha256(convert_to($1, 'UTF8')), 'hex') as attendue from public.reglages_paiement",
      [J],
    );
    expect(rows[0].empreinte).toBe(rows[0].attendue);
    expect(rows[0].empreinte).not.toBe(J);
    await expect(banc.en({ id: S }, "select * from public.reglages_paiement")).rejects.toThrow();
  });

  it("seul le jeton du serveur confirme, et une seule fois", async () => {
    const p = await preparer(E, formules.standard, "PROMO20");
    await noterEssai(p.id, "pay_1");
    await expect(confirmer({ id: E }, p.id, "pay_1", 12000, "faux")).rejects.toThrow("Jeton de paiement non reconnu.");
    await expect(confirmer("anon", p.id, "pay_1", 1000)).rejects.toThrow("Montant différent du paiement enregistré.");
    await expect(confirmer("anon", p.id, "pay_autre", 12000)).rejects.toThrow("Paiement Payiz différent.");
    const ok = await confirmer("anon", p.id, "pay_1", 12000);
    expect(ok.statut).toBe("reussi");
    expect(ok.numero_recu).toMatch(/^ET-R-\d{4}-\d{6}$/);
    expect(ok.abonnement).not.toBeNull();
    expect((await confirmer("anon", p.id, "pay_1", 12000)).numero_recu).toBe(ok.numero_recu);
    expect((await banc.db.query<{ n: number }>("select count(*)::int as n from public.abonnements where profil_id = $1", [E])).rows[0].n).toBe(1);
    expect((await banc.db.query<{ r: boolean }>("select public.abonne($1) as r", [E])).rows[0].r).toBe(true);
  });

  it("un paiement noté expiré puis payé s'active quand même", async () => {
    const p = await preparer(E, formules.standard, null);
    await noterEssai(p.id, "pay_2");
    expect((await noterEchec(p.id, "expire", null)).statut).toBe("expire");
    expect((await confirmer("anon", p.id, "pay_2", 15000)).statut).toBe("reussi");
  });

  it("les durées s'ajoutent", async () => {
    const premier = await preparer(E, formules.standard, null);
    await noterEssai(premier.id, "pay_a");
    const a1 = (await confirmer("anon", premier.id, "pay_a", 15000)).abonnement!;
    const second = await preparer(E, formules.basique, null);
    await noterEssai(second.id, "pay_b");
    const a2 = (await confirmer("anon", second.id, "pay_b", 9000)).abonnement!;
    const { rows } = await banc.db.query<{ suite: boolean; duree: boolean }>(
      "select $1::timestamptz = $2::timestamptz as suite, $3::timestamptz = public.fin_periode($2::timestamptz, 3) as duree",
      [a1.fin, a2.debut, a2.fin],
    );
    expect(rows[0]).toEqual({ suite: true, duree: true });
    const etat = await rpc<{ etat: string; formule: { code: string; nom: string }; fin: string }>({ id: E }, "select public.mon_abonnement() as r");
    expect(etat).toMatchObject({ etat: "actif", formule: { code: "standard", nom: "Standard" } });
    expect(new Date(etat.fin).getTime()).toBe(new Date(a2.fin).getTime());
  });

  it("31 août + 6 mois = 28 février, à l'heure du Bénin", async () => {
    const { rows } = await banc.db.query<{ ok: boolean }>(
      "select public.fin_periode('2026-08-31 00:00+01'::timestamptz, 6) = '2027-02-28 00:00+01'::timestamptz as ok",
    );
    expect(rows[0].ok).toBe(true);
  });

  it("un échec se note, se relance et ne consomme pas le code", async () => {
    const p = await preparer(G, formules.standard, "PROMO20");
    await noterEssai(p.id, "pay_g2");
    expect(await noterEchec(p.id, "echoue", "insufficient_funds")).toMatchObject({ statut: "echoue", motif_echec: "insufficient_funds" });
    expect((await noterEchec(p.id, "echoue", "bizarre")).motif_echec).toBe("unknown");
    expect(await noterEssai(p.id, "pay_g2")).toMatchObject({ statut: "en_attente", motif_echec: null });
    expect(await essayer(G, "PROMO20", formules.standard)).toMatchObject({ ok: true });
  });

  it("100 % : abonnement offert sans Payiz, même paiements fermés", async () => {
    await empreinte(null);
    const p = await preparer(E, formules.standard, "OFFERT");
    expect(p).toMatchObject({ statut: "reussi", montant: 0, remise: 15000 });
    expect(p.numero_recu).toMatch(/^ET-R-\d{4}-\d{6}$/);
    expect(p.abonnement).not.toBeNull();
  });

  it("chacun ne lit que ses paiements et ses reçus", async () => {
    const p = await preparer(E, formules.standard, null);
    await noterEssai(p.id, "pay_e");
    const { numero_recu } = await confirmer("anon", p.id, "pay_e", 15000);
    const jamaisEnvoye = await preparer(E, formules.basique, null);
    const ids = async (qui: string) => (await rpc<Carte[]>({ id: qui }, "select public.mes_paiements() as r")).map((c) => c.id);
    expect(await ids(E)).toEqual([p.id]);
    expect(await ids(E)).not.toContain(jamaisEnvoye.id);
    expect(await ids(G)).not.toContain(p.id);
    const recu = (qui: string) => rpc<Record<string, unknown> | null>({ id: qui }, "select public.recu($1) as r", [numero_recu]);
    expect(await recu(G)).toBeNull();
    expect(await recu(E)).toMatchObject({ numero: numero_recu, montant: 15000, formule: { nom: "Standard", duree_mois: 6 } });
    expect(await recu(S)).not.toBeNull();
    expect(await rpc<unknown>({ id: G }, "select public.mon_paiement($1) as r", [p.id])).toBeNull();
  });

  it("une notification Payiz : notée traitée une seule fois, seulement avec le jeton", async () => {
    const traitee = () => rpc<boolean>("anon", "select public.evenement_payiz_traite('evt_1', $1) as r", [J]);
    expect(await traitee()).toBe(false);
    expect(await rpc<boolean>("anon", "select public.evenement_payiz('evt_1', $1) as r", [J])).toBe(true);
    expect(await rpc<boolean>("anon", "select public.evenement_payiz('evt_1', $1) as r", [J])).toBe(false);
    expect(await traitee()).toBe(true);
    await expect(rpc<boolean>("anon", "select public.evenement_payiz_traite('evt_1', 'faux') as r")).rejects.toThrow("Jeton de paiement non reconnu.");
  });

  it("désactiver garde l'empreinte : un paiement déjà envoyé se confirme encore (revue finale)", async () => {
    await banc.en({ id: S }, "select public.activer_paiements($1)", [J]);
    const p = await preparer(E, formules.standard, null);
    await noterEssai(p.id, "pay_d1");
    await banc.en({ id: S }, "select public.desactiver_paiements()");
    expect(await rpc<boolean>("anon", "select public.paiements_ouverts() as r")).toBe(false);
    expect((await confirmer("anon", p.id, "pay_d1", 15000)).statut).toBe("reussi");
    await expect(preparer(E, formules.basique, null)).rejects.toThrow("Les paiements ouvrent bientôt.");
  });

  it("« prêts » : ouverts, et le jeton du serveur reconnu (revue finale)", async () => {
    const prets = (jeton: string) => rpc<boolean>("anon", "select public.paiements_prets($1) as r", [jeton]);
    await banc.en({ id: S }, "select public.activer_paiements($1)", [J]);
    expect(await prets(J)).toBe(true);
    expect(await prets("k".repeat(40))).toBe(false);
    await banc.en({ id: S }, "select public.desactiver_paiements()");
    expect(await prets(J)).toBe(false);
  });

  it("préparer se verrouille par compte et sur le code (demandes simultanées ; revue finale)", async () => {
    // PGlite n'a qu'une connexion : la course elle-même ne se rejoue pas ici ; on vérifie les deux verrous.
    const { rows } = await banc.db.query<{ d: string }>("select pg_get_functiondef('public.preparer_paiement(uuid, text)'::regprocedure) as d");
    expect(rows[0].d).toContain("pg_advisory_xact_lock");
    expect(rows[0].d).toMatch(/from public\.codes_promo[^;]*for update/);
  });

  it("un formateur n'a pas d'abonnement", async () => {
    await expect(preparer(F, formules.standard, null)).rejects.toThrow("Un compte formateur n’a pas d’abonnement.");
  });
});
