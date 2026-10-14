import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0022 : la vidéo jointe aux publications (spec mise en forme et vidéo, §3 et §4).
const MIGRATION = "supabase/migrations/0022_communaute_video.sql";
const REFUS = "Cette vidéo n’est pas reconnue.";

let banc: Banc;
const E1 = randomUUID();

const verifier = async (video: unknown) => (await banc.db.query<{ v: unknown }>("select public.verifier_video($1::jsonb) as v", [video === undefined ? null : JSON.stringify(video)])).rows[0].v;
const publier = async (video: unknown) =>
  (await banc.en<{ r: { id: string } }>({ id: E1 }, "select public.publier(null, '', 'Regardez', null, null, null, $1::jsonb) as r", [JSON.stringify(video)]))[0].r.id;

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    "supabase/migrations/0004_contenus.sql",
    "supabase/migrations/0005_back_office.sql",
    "supabase/migrations/0006_notes.sql",
    "supabase/migrations/0007_visionnage.sql",
    "supabase/migrations/0008_progression.sql",
    "supabase/migrations/0009_favoris.sql",
    "supabase/migrations/0010_avis.sql",
    "supabase/migrations/0011_statistiques.sql",
    "supabase/exemples/lot-1.sql",
    "supabase/migrations/0012_couvertures.sql",
    "supabase/migrations/0013_utilisateurs.sql",
    "supabase/migrations/0014_espace_formateur.sql",
    "supabase/migrations/0015_suivi_etudiants.sql",
    "supabase/migrations/0016_notifications.sql",
    "supabase/migrations/0017_role_unique.sql",
    "supabase/migrations/0018_sessions_live.sql",
    "supabase/migrations/0019_communaute.sql",
    "supabase/migrations/0020_moderation.sql",
    "supabase/migrations/0021_communaute_actualites.sql",
    MIGRATION,
  ]);
  await banc.creerCompte(E1, []);
});

describe("La vidéo jointe", () => {
  it("chaque plateforme acceptée et normalisée (champs inconnus retirés) ; aucune vidéo : null", async () => {
    const cas: Record<string, string> = {
      youtube: "dQw4w9WgXcQ",
      vimeo: "76979871",
      dailymotion: "x8abc12",
      loom: "0123456789abcdef0123456789abcdef",
      tiktok: "7300123456789012345",
      facebook: "123456789012345",
      instagram: "C1a2B3c4D5e",
      drive: "1AbCdEfGhIjKlMnOpQrStUvWxYz012345",
    };
    for (const [plateforme, id] of Object.entries(cas)) {
      expect(await verifier({ plateforme, id, url: "https://exemple.com/v", titre: "intrus", autre: 1 })).toEqual({ plateforme, id, url: "https://exemple.com/v" });
    }
    expect(await verifier({ plateforme: "vimeo", id: "76979871", h: "8272103f6e", url: "https://vimeo.com/76979871/8272103f6e" })).toEqual({
      plateforme: "vimeo",
      id: "76979871",
      h: "8272103f6e",
      url: "https://vimeo.com/76979871/8272103f6e",
    });
    expect(await verifier({ plateforme: "vimeo", id: "76979871", h: "../x", url: "https://vimeo.com/76979871" })).toEqual({ plateforme: "vimeo", id: "76979871", url: "https://vimeo.com/76979871" });
    expect(await verifier({ plateforme: "fichier", url: "https://cdn.exemple.com/cours.MP4?v=2" })).toEqual({ plateforme: "fichier", url: "https://cdn.exemple.com/cours.MP4?v=2" });
    expect(await verifier({ plateforme: "autre", url: "https://www.twitch.tv/x", titre: "  Un\n live  ", image: "http://non-https.com/a.jpg" })).toEqual({
      plateforme: "autre",
      url: "https://www.twitch.tv/x",
      titre: " Un live ",
    });
    expect(await verifier(undefined)).toBeNull();
    expect(await verifier(null)).toBeNull();
  });

  it("refusées : identifiant hors forme, plateforme inconnue, adresse douteuse ou trop longue, fichier en http", async () => {
    for (const video of [
      { plateforme: "youtube", id: "../../x", url: "https://youtu.be/x" },
      { plateforme: "youtube", url: "https://youtu.be/x" },
      { plateforme: "inconnue", id: "x", url: "https://exemple.com" },
      { plateforme: "youtube", id: "dQw4w9WgXcQ", url: "javascript:alert(1)" },
      { plateforme: "youtube", id: "dQw4w9WgXcQ", url: `https://exemple.com/${"a".repeat(1000)}` },
      { plateforme: "fichier", url: "http://exemple.com/cours.mp4" },
      { plateforme: "fichier", url: "https://exemple.com/page.html" },
      { plateforme: "autre", url: "https://exemple.com/a b" },
      ["pas", "un", "objet"],
    ]) {
      await expect(verifier(video)).rejects.toThrow(REFUS);
    }
  });

  it("publier avec une vidéo : rangée et rendue par la carte ; une seule signature ; la vérification est interne ; rejouable", async () => {
    const id = await publier({ plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" });
    const carte = (await banc.en<{ r: { video: unknown } }>({ id: E1 }, "select public.publication_communaute($1) as r", [id]))[0].r;
    expect(carte.video).toEqual({ plateforme: "youtube", id: "dQw4w9WgXcQ", url: "https://youtu.be/dQw4w9WgXcQ" });
    await expect(publier({ plateforme: "youtube", id: "x", url: "https://youtu.be/x" })).rejects.toThrow(REFUS);
    const signatures = (await banc.db.query<{ n: number }>("select pronargs as n from pg_proc where proname = 'publier' and pronamespace = 'public'::regnamespace")).rows.map((r) => r.n);
    expect(signatures).toEqual([7]);
    await expect(banc.en({ id: E1 }, "select public.verifier_video('{}'::jsonb)")).rejects.toThrow(/permission denied/);
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
  });
});
