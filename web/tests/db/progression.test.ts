import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0008 : visite d'une leçon (dernière leçon ouverte, pour « Continuer ») et fin d'une leçon sans vidéo
// (« Marquer comme terminée », spec Q3). Une leçon vidéo ne se termine qu'en la regardant (0007).
const MIGRATION = "supabase/migrations/0008_progression.sql";

describe("Migration 0008 : progression", () => {
  let banc: Banc;
  const E = randomUUID();
  const F = randomUUID();
  let texte: string;
  let video: string;
  let fermee: string;

  const idLecon = async (titre: string) => (await banc.db.query<{ id: string }>("select id from public.lecons where titre = $1", [titre])).rows[0].id;
  const ligne = async (qui: string, lecon: string) =>
    (
      await banc.db.query<{ ouverte: string; vue: string; terminee: string | null }>(
        "select ouverte_le::text as ouverte, vue_le::text as vue, terminee_le::text as terminee from public.progression_lecons where profil_id = $1 and lecon_id = $2",
        [qui, lecon],
      )
    ).rows[0];

  beforeAll(async () => {
    banc = await creerBanc([
      ...MIGRATIONS_LOT_0,
      "supabase/migrations/0004_contenus.sql",
      "supabase/migrations/0005_back_office.sql",
      "supabase/migrations/0006_notes.sql",
      "supabase/migrations/0007_visionnage.sql",
      MIGRATION,
      "supabase/exemples/lot-1.sql",
    ]);
    await banc.creerCompte(E);
    await banc.creerCompte(F);
    texte = await idLecon("Saisir et mettre en forme des données"); // aperçu, sans vidéo
    video = await idLecon("Découvrir l’interface"); // aperçu
    fermee = await idLecon("Les formules essentielles");
    await banc.db.query("insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id) values ($1, 'youtube', 'dQw4w9WgXcQ')", [video]);
  });

  it("ouvrir une leçon la note, puis met à jour la dernière visite sans changer la première", async () => {
    await banc.en({ id: E }, "select public.ouvrir_lecon($1)", [texte]);
    const avant = await ligne(E, texte);
    expect(avant).toBeDefined();
    await banc.db.query("update public.progression_lecons set vue_le = now() - interval '1 day', ouverte_le = now() - interval '2 days' where lecon_id = $1", [texte]);
    await banc.en({ id: E }, "select public.ouvrir_lecon($1)", [texte]);
    const apres = await ligne(E, texte);
    expect(new Date(apres.vue).getTime()).toBeGreaterThan(Date.now() - 60_000);
    expect(new Date(apres.ouverte).getTime()).toBeLessThan(Date.now() - 86_400_000);
  });

  it("une leçon sans vidéo se termine par le bouton, une fois pour toutes", async () => {
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [texte]);
    const premiere = (await ligne(E, texte)).terminee;
    expect(premiere).not.toBeNull();
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [texte]);
    expect((await ligne(E, texte)).terminee).toBe(premiere);
  });

  it("une leçon vidéo ne se termine pas par le bouton : il faut la regarder", async () => {
    await expect(banc.en({ id: E }, "select public.terminer_lecon($1)", [video])).rejects.toThrow(/vidéo/);
  });

  it("leçon fermée ou visiteur : refusé", async () => {
    await expect(banc.en({ id: E }, "select public.ouvrir_lecon($1)", [fermee])).rejects.toThrow(/inaccessible/);
    await expect(banc.en({ id: E }, "select public.terminer_lecon($1)", [fermee])).rejects.toThrow(/inaccessible/);
    await expect(banc.en("anon", "select public.ouvrir_lecon($1)", [texte])).rejects.toThrow();
  });

  it("chacun ne voit que sa progression", async () => {
    expect(await banc.en({ id: F }, "select lecon_id from public.progression_lecons where profil_id = $1", [E])).toEqual([]);
  });

  it("la migration se rejoue sans perdre la progression", async () => {
    await banc.appliquer(MIGRATION);
    expect((await ligne(E, texte)).terminee).not.toBeNull();
  });
});
