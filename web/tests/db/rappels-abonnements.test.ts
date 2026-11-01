import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0052 (lot 2, spec §8) : les rappels d'expiration dans l'appli (catégorie « Expiration et renouvellement »),
// 7 jours avant, la veille et le jour de la fin réelle de l'accès, chacun une seule fois ; par la tâche planifiée et à
// l'ouverture de la cloche. Et le nettoyage des paiements restés en attente.

let banc: Banc;
const comptes = Object.fromEntries(["sept", "veille", "expire", "enchaine", "annule", "cloche"].map((n) => [n, randomUUID()])) as Record<string, string>;

type Notif = { titre: string; texte: string; lien: string; categorie: string };
const notifications = async (compte: string) =>
  (await banc.db.query<Notif>("select titre, texte, lien, categorie from public.notifications where destinataire = $1 order by id", [compte])).rows;
const traiter = async () => (await banc.db.query<{ n: number }>("select public.traiter_abonnements() as n")).rows[0].n;

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
      "0050_acces_abonnes", "0051_paiements_equipe", "0052_rappels_abonnements",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const id of Object.values(comptes)) await banc.creerCompte(id);
  await abonner(banc, comptes.sept, { fin: "now() + interval '6 days 23 hours'" });
  await abonner(banc, comptes.veille, { fin: "now() + interval '20 hours'" });
  await abonner(banc, comptes.expire, { debut: "now() - interval '3 months'", fin: "now() - interval '1 hour'" });
  await abonner(banc, comptes.enchaine, { fin: "now() + interval '6 days'" });
  await abonner(banc, comptes.enchaine, { formule: "basique", debut: "now() + interval '6 days'", fin: "now() + interval '96 days'" });
  await abonner(banc, comptes.annule, { fin: "now() + interval '6 days'", annule: true });
});

describe("Les rappels d'expiration", () => {
  it("la date en clair, à l'heure du Bénin", async () => {
    const { rows } = await banc.db.query<{ a: string; b: string }>(
      "select public.date_longue('2027-03-14 10:00+01') as a, public.date_longue('2027-04-30 23:30+00') as b",
    );
    expect(rows[0]).toEqual({ a: "14 mars 2027", b: "1er mai 2027" });
  });

  it("7 jours avant, la veille, le jour de l'expiration : chacun une fois", async () => {
    expect(await traiter()).toBe(3);
    const [sept] = await notifications(comptes.sept);
    expect(sept).toMatchObject({ titre: "Votre abonnement Standard se termine dans 7 jours", lien: "/abonnement/souscrire", categorie: "expiration_renouvellement" });
    expect(sept.texte).toMatch(/^Il prend fin le \d{1,2}(er)? \S+ \d{4}\. Prolongez-le pour garder l’accès à tout\.$/);
    expect((await notifications(comptes.veille)).map((n) => n.titre)).toEqual(["Votre abonnement Standard se termine demain"]);
    expect(await notifications(comptes.expire)).toEqual([
      {
        titre: "Votre abonnement Standard a expiré",
        texte: "Vos formations payantes sont verrouillées. Votre progression et vos certificats restent sur votre compte.",
        lien: "/abonnement/souscrire",
        categorie: "expiration_renouvellement",
      },
    ]);
    expect(await traiter()).toBe(0);
    expect(await notifications(comptes.sept)).toHaveLength(1);
  });

  it("rien pour un abonnement suivi d'un autre, ni pour un abonnement annulé", async () => {
    expect(await notifications(comptes.enchaine)).toEqual([]);
    expect(await notifications(comptes.annule)).toEqual([]);
  });

  it("à l'ouverture de la cloche aussi", async () => {
    await abonner(banc, comptes.cloche, { fin: "now() + interval '5 days'" });
    await banc.en({ id: comptes.cloche }, "select public.rappels_sessions()");
    // Un rappel parti en retard dit le vrai nombre de jours.
    expect((await notifications(comptes.cloche)).map((n) => n.titre)).toEqual(["Votre abonnement Standard se termine dans 5 jours"]);
  });
});

describe("Le nettoyage des paiements", () => {
  it("un paiement en attente depuis plus d'une heure passe à « expiré », pas un récent", async () => {
    const inserer = async (essai: string) =>
      (
        await banc.db.query<{ id: string }>(
          `insert into public.paiements (profil_id, formule_id, prix_initial, montant, payiz_id, essai_le)
           select $1, id, 15000, 15000, $2, ${essai} from public.formules where code = 'standard' returning id`,
          [comptes.sept, `pay_${randomUUID().slice(0, 8)}`],
        )
      ).rows[0].id;
    const ancien = await inserer("now() - interval '2 hours'");
    const recent = await inserer("now() - interval '1 minute'");
    await traiter();
    const statut = async (id: string) => (await banc.db.query<{ statut: string }>("select statut from public.paiements where id = $1", [id])).rows[0].statut;
    expect(await statut(ancien)).toBe("expire");
    expect(await statut(recent)).toBe("en_attente");
  });
});
