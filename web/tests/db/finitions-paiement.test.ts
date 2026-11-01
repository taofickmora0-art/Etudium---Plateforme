import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, MIGRATIONS_LOT_0, type Banc, type Qui } from "./banc";

// Migration 0053 (finitions du paiement, relecture du lot 2) : une préparation reprise après une coupure, l'abonnement
// suivant avancé à l'annulation du précédent, des confirmations simultanées enchaînées, une limite d'essais de codes ;
// et les accès refusés vérifiés (jeton, écritures directes, fonctions internes).

let banc: Banc;
const S = randomUUID(); // super admin
const E = randomUUID(); // étudiante
const G = randomUUID(); // étudiant
const J = "j".repeat(40);
const formules: Record<string, string> = {};

type Carte = { id: string; statut: string; montant: number; repris?: boolean };
const rpc = async <T>(qui: Qui, sql: string, params: unknown[] = []) => (await banc.en<{ r: T }>(qui, sql, params))[0].r;
const preparer = (qui: string, formule: string, code: string | null = null) => rpc<Carte>({ id: qui }, "select public.preparer_paiement($1, $2) as r", [formule, code]);
const essayer = (qui: string, code: string) => rpc<{ ok: boolean; message?: string }>({ id: qui }, "select public.essayer_code($1, $2) as r", [code, formules.standard]);

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
      "0050_acces_abonnes", "0051_paiements_equipe", "0052_rappels_abonnements", "0053_finitions_paiement",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [E, []], [G, []]] as const) await banc.creerCompte(id, [...roles]);
  for (const { id, code } of (await banc.db.query<{ id: string; code: string }>("select id, code from public.formules")).rows) formules[code] = id;
  await banc.db.query("update public.formules set prix_fcfa = 15000 where code = 'standard'");
  await banc.db.query("update public.formules set prix_fcfa = 9000 where code = 'basique'");
  await banc.db.query("insert into public.codes_promo (code, type, valeur) values ('PROMO20', 'pourcentage', 20)");
  await banc.en({ id: S }, "select public.activer_paiements($1)", [J]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.essais_codes");
});

describe("Une préparation reprise", () => {
  it("un second « Payer » sans réponse de Payiz reprend la même préparation (même clé d'idempotence)", async () => {
    const a = await preparer(E, formules.standard);
    expect((await preparer(E, formules.standard)).id).toBe(a.id);
    expect((await preparer(E, formules.standard, "PROMO20")).id).not.toBe(a.id);
    expect((await preparer(E, formules.basique)).id).not.toBe(a.id);
  });
});

describe("L'annulation d'un abonnement suivi d'un autre", () => {
  it("le suivant commence aussitôt, avec toute sa durée : pas de trou dans l'accès", async () => {
    const enCours = await abonner(banc, G, { debut: "now() - interval '1 day'", fin: "now() + interval '30 days'" });
    // Un temps entre les deux créations (une machine chargée) ne doit rien changer.
    await banc.db.query("select pg_sleep(0.2)");
    // Comme activer_paiement : le suivant commence exactement à la fin de celui en cours.
    const finEnCours = `(select fin from public.abonnements where id = '${enCours}')`;
    const suivant = await abonner(banc, G, { formule: "basique", debut: finEnCours, fin: `${finEnCours} + interval '90 days'` });
    await banc.en({ id: S }, "select public.annuler_abonnement($1, 'Remboursé depuis Payiz')", [enCours]);
    const { rows } = await banc.db.query<{ debut_ok: boolean; duree_ok: boolean; abonne: boolean }>(
      `select debut <= now() + interval '1 minute' and debut >= now() - interval '1 minute' as debut_ok,
              fin - debut = interval '90 days' as duree_ok, public.abonne($2) as abonne
       from public.abonnements where id = $1`,
      [suivant, G],
    );
    expect(rows[0]).toEqual({ debut_ok: true, duree_ok: true, abonne: true });
  });
});

describe("Des confirmations simultanées", () => {
  it("l'activation se verrouille par compte : deux abonnements s'enchaînent au lieu de se chevaucher", async () => {
    // PGlite n'a qu'une connexion : la course ne se rejoue pas ici ; on vérifie le verrou.
    const { rows } = await banc.db.query<{ d: string }>("select pg_get_functiondef('public.activer_paiement(uuid)'::regprocedure) as d");
    expect(rows[0].d).toContain("pg_advisory_xact_lock");
  });
});

describe("Les essais de codes promo", () => {
  it("10 essais par 10 minutes et par compte, puis un message", async () => {
    for (let i = 0; i < 10; i++) expect((await essayer(G, `FAUX${i}A`)).message).toBe("Ce code n’existe pas.");
    expect(await essayer(G, "PROMO20")).toEqual({ ok: false, message: "Trop d’essais de code. Réessayez dans quelques minutes." });
    await expect(preparer(G, formules.standard, "PROMO20")).rejects.toThrow("Trop d’essais de code. Réessayez dans quelques minutes.");
    expect(await essayer(E, "PROMO20")).toMatchObject({ ok: true });
  });
});

describe("Les accès refusés", () => {
  it("noter un essai avec un mauvais jeton", async () => {
    const p = await preparer(G, formules.basique);
    await expect(rpc("anon", "select public.noter_essai($1, 'pay_x', 'mtn', '+229 01 •• •• •• 00', 'faux') as r", [p.id])).rejects.toThrow(
      "Jeton de paiement non reconnu.",
    );
  });

  it("aucune écriture directe dans les paiements ni les abonnements", async () => {
    await expect(
      banc.en({ id: E }, "insert into public.paiements (profil_id, formule_id, prix_initial, montant, statut) values ($1, $2, 15000, 15000, 'reussi')", [E, formules.standard]),
    ).rejects.toThrow();
    await expect(banc.en({ id: E }, "update public.paiements set statut = 'reussi' where profil_id = $1", [E])).rejects.toThrow();
    await expect(
      banc.en({ id: E }, "insert into public.abonnements (profil_id, formule_id, paiement_id, debut, fin) select $1, $2, id, now(), now() + interval '1 year' from public.paiements limit 1", [E, formules.standard]),
    ).rejects.toThrow();
  });

  it("aucun appel direct des fonctions internes", async () => {
    const p = await preparer(E, formules.basique);
    await expect(banc.en({ id: E }, "select public.activer_paiement($1)", [p.id])).rejects.toThrow(/permission denied/);
    await expect(banc.en({ id: E }, "select public.abonne($1)", [E])).rejects.toThrow(/permission denied/);
  });
});
