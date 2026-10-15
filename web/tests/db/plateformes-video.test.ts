import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0030 : les vidéos des leçons sur TikTok et Tella (mesurées), Loom, ScreenPal et Google Drive (sans mesure)
// (spec 2026-10-15-plateformes-video-design).

let banc: Banc;
const S = randomUUID(); // super admin
const E = randomUUID(); // étudiant
let module_: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const lecon = async (fournisseur: string | null, id: string | null) => {
  const l = (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, duree_secondes) values ($1, 'Leçon', true, 120) returning id", [module_])).id;
  await banc.db.query("insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id) values ($1, $2, $3) on conflict (lecon_id) do update set video_fournisseur = excluded.video_fournisseur, video_id = excluded.video_id", [l, fournisseur, id]);
  return l;
};

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [E, []]] as const) await banc.creerCompte(id, [...roles]);
  const f = (await un<{ id: string }>("insert into public.formations (titre, slug, gratuite) values ('Gratuite', $1, true) returning id", [randomUUID()])).id;
  module_ = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module') returning id", [f])).id;
  await lecon(null, null);
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [f]);
});

describe("Migration 0030 : les vidéos sur d'autres plateformes", () => {
  it("chaque plateforme garde un identifiant à son format", async () => {
    for (const [fournisseur, id] of [
      ["tiktok", "7234567890123456789"],
      ["tella", "mon-cours-excel-a1b2"],
      ["loom", "0123456789abcdef0123456789abcdef"],
      ["screenpal", "c01QoOVBTGv"],
      ["drive", "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"],
      ["youtube", "dQw4w9WgXcQ"],
      ["vimeo", "76979871/abcdef0123"],
    ]) {
      await expect(lecon(fournisseur, id), `${fournisseur} ${id}`).resolves.toBeTruthy();
    }
  });

  it("un identifiant qui n'a pas le format de sa plateforme est refusé", async () => {
    for (const [fournisseur, id] of [
      ["tiktok", "abc"],
      ["tella", "un code avec espaces"],
      ["loom", "pas-hexadecimal"],
      ["screenpal", "a/b"],
      ["drive", "court"],
      ["tiktok", null],
    ]) {
      await expect(lecon(fournisseur, id), `${fournisseur} ${id}`).rejects.toThrow(/lecons_contenus_video/);
    }
  });

  it("une vidéo sans mesure (Drive, Loom, ScreenPal) se termine d'un clic ; YouTube et Vimeo, non ; TikTok et Tella aussi, en secours quand leur lecteur ne répond pas (revue)", async () => {
    for (const [fournisseur, id] of [
      ["drive", "1AbCdEfGhIjKlMnOpQrStUvWxYz012345"],
      ["loom", "0123456789abcdef0123456789abcdef"],
      ["screenpal", "c01QoOVBTGv"],
    ]) {
      const l = await lecon(fournisseur, id);
      await banc.en({ id: E }, "select public.terminer_lecon($1)", [l]);
      expect((await un<{ fin: string | null }>("select terminee_le as fin from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, l])).fin).not.toBeNull();
      await expect(banc.en({ id: E }, "select public.commencer_visionnage($1)", [l])).rejects.toThrow("Le temps regardé ne se mesure pas sur cette plateforme.");
    }
    const youtube = await lecon("youtube", "dQw4w9WgXcQ");
    await expect(banc.en({ id: E }, "select public.terminer_lecon($1)", [youtube])).rejects.toThrow("Une leçon vidéo se termine en la regardant.");
    const tella = await lecon("tella", "mon-cours-excel-a1b2");
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [tella]);
    const tiktok = await lecon("tiktok", "7234567890123456789");
    await banc.en({ id: E }, "select public.commencer_visionnage($1)", [tiktok]);
    // 10 s écoulées depuis le début du visionnage : 5 s regardées sont plausibles.
    await banc.db.query("update public.progression_lecons set dernier_envoi = now() - interval '10 seconds' where profil_id = $1 and lecon_id = $2", [E, tiktok]);
    const r = (await banc.en<{ r: { reference: number } }>({ id: E }, "select public.enregistrer_visionnage($1, '{[0,5)}'::int4multirange, 5) as r", [tiktok]))[0].r;
    expect(r.reference).toBe(120);
  });
});
