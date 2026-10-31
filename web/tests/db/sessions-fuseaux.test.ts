import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0045 (liste du 31 octobre 2026, tâche 10) : les heures des lives écrites par la base (notifications) disent
// leur fuseau, « (GMT+1) », pour qu'on les comprenne d'un pays à l'autre ; et « Rejoindre » n'ouvrant le lien qu'à
// l'heure du début, les rappels ne disent plus que le lien est ouvert 10 min avant.

let banc: Banc;
const S = randomUUID();
const F = randomUUID();
const E = randomUUID();
let FA: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const recues = async (compte: string) =>
  (await banc.db.query<{ titre: string; texte: string }>("select titre, texte from public.notifications where destinataire = $1 and categorie = 'sessions_live' order by id", [compte])).rows;
async function session(debutDans: string, titre = "Excel avancé") {
  return (await un<{ id: string }>(
    `insert into public.sessions_live (titre, debut, duree_minutes, lien, formateur_id, statut, cree_par)
     values ($1, now() + $2::interval, 60, 'https://meet.google.com/abc-defg-hij', $3, 'programmee', $4) returning id`,
    [titre, debutDans, FA, F],
  )).id;
}

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
      "0044_temps_reel", "0045_sessions_fuseaux",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [F, []], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
});

beforeEach(async () => {
  await banc.db.query("delete from public.notifications");
  await banc.db.query("delete from public.sessions_live");
});

describe("Les heures écrites par la base", () => {
  it("« samedi 24 octobre à 15 h 00 (GMT+1) » et « 15 h 00 (GMT+1) » : l'heure du Bénin, et son décalage", async () => {
    const q = async (iso: string) => (await un<{ q: string }>("select public.quand_session($1::timestamptz) as q", [iso])).q;
    const h = async (iso: string) => (await un<{ h: string }>("select public.heure_session($1::timestamptz) as h", [iso])).h;
    expect(await q("2026-10-24T14:00:00Z")).toBe("samedi 24 octobre à 15 h 00 (GMT+1)");
    expect(await q("2026-10-24T23:30:00Z")).toBe("dimanche 25 octobre à 0 h 30 (GMT+1)");
    expect(await h("2026-10-24T14:05:00Z")).toBe("15 h 05 (GMT+1)");
  });
});

describe("Les rappels", () => {
  it("10 min avant : plus de « lien ouvert » ; il se rejoint à l'heure du début, depuis la page Événements", async () => {
    const id = await session("8 minutes");
    await banc.db.query("insert into public.inscriptions_sessions (session_id, profil_id) values ($1, $2)", [id, E]);
    await banc.db.query("select public.traiter_sessions_live()");
    const [rappel] = await recues(E);
    expect(rappel.titre).toBe("Session live dans 10 minutes");
    expect(rappel.texte).toMatch(/^Excel avancé, à \d{1,2} h \d{2} \(GMT\+1\)\. Rejoignez-la depuis la page Événements, à l’heure du début\.$/);
  });

  it("1 h avant : « Rejoindre » s'ouvre à l'heure du début", async () => {
    const id = await session("50 minutes");
    await banc.db.query("insert into public.inscriptions_sessions (session_id, profil_id) values ($1, $2)", [id, E]);
    await banc.db.query("select public.traiter_sessions_live()");
    const [rappel] = await recues(E);
    expect(rappel.titre).toBe("Session live dans moins d’une heure");
    expect(rappel.texte).toMatch(/^Excel avancé, à \d{1,2} h \d{2} \(GMT\+1\)\. « Rejoindre » s’ouvre à l’heure du début\.$/);
  });
});
