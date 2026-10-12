import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0007 : temps réellement regardé (spec du lot 1, §5). La base refuse un passage plus long que le temps
// écoulé et valide la leçon au seuil de la formation (90 % par défaut).
const MIGRATION = "supabase/migrations/0007_visionnage.sql";

type Resultat = { secondes_vues: number; reference: number; terminee: boolean };

describe("Migration 0007 : visionnage", () => {
  let banc: Banc;
  const E = randomUUID();
  const F = randomUUID();
  let video: string;
  let sansVideo: string;
  let fermee: string;

  const idLecon = async (titre: string) => (await banc.db.query<{ id: string }>("select id from public.lecons where titre = $1", [titre])).rows[0].id;
  const commencer = (qui: string, lecon: string) => banc.en({ id: qui }, "select public.commencer_visionnage($1)", [lecon]);
  const enregistrer = async (qui: string, lecon: string, passages: string, position = 0, duree: number | null = null) =>
    (
      await banc.en<{ r: Resultat }>({ id: qui }, "select public.enregistrer_visionnage($1, $2::int4multirange, $3, $4) as r", [
        lecon,
        passages,
        position,
        duree,
      ])
    )[0].r;
  /** Fait comme si le dernier envoi datait de `secondes` secondes. */
  const reculer = (qui: string, lecon: string, secondes: number) =>
    banc.db.query("update public.progression_lecons set dernier_envoi = now() - make_interval(secs => $3) where profil_id = $1 and lecon_id = $2", [
      qui,
      lecon,
      secondes,
    ]);
  const passagesDe = async (qui: string, lecon: string) =>
    (await banc.db.query<{ p: string }>("select passages::text as p from public.progression_lecons where profil_id = $1 and lecon_id = $2", [qui, lecon])).rows[0]
      ?.p;

  beforeAll(async () => {
    banc = await creerBanc([
      ...MIGRATIONS_LOT_0,
      "supabase/migrations/0004_contenus.sql",
      "supabase/migrations/0005_back_office.sql",
      "supabase/migrations/0006_notes.sql",
      MIGRATION,
      "supabase/exemples/lot-1.sql",
    ]);
    await banc.creerCompte(E);
    await banc.creerCompte(F);
    video = await idLecon("Découvrir l’interface"); // aperçu, 370 s
    sansVideo = await idLecon("Saisir et mettre en forme des données"); // aperçu, sans vidéo
    fermee = await idLecon("Les formules essentielles");
    await banc.db.query("insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id) values ($1, 'youtube', 'dQw4w9WgXcQ')", [video]);
    await banc.db.query("insert into public.lecons_contenus (lecon_id, video_fournisseur, video_id) values ($1, 'youtube', 'dQw4w9WgXcQ')", [fermee]);
  });

  it("les passages regardés s'additionnent, sans compter deux fois le même passage", async () => {
    await commencer(E, video);
    await reculer(E, video, 30);
    expect(await enregistrer(E, video, "{[0,40)}", 40)).toEqual({ secondes_vues: 40, reference: 370, terminee: false });
    await reculer(E, video, 30);
    expect(await enregistrer(E, video, "{[20,60)}", 60)).toMatchObject({ secondes_vues: 60 });
    expect(await passagesDe(E, video)).toBe("{[0,60)}");
  });

  it("un envoi plus long que le temps écoulé est refusé (vitesse 2× au plus)", async () => {
    await reculer(E, video, 30);
    await expect(enregistrer(E, video, "{[60,360)}")).rejects.toThrow(/plus long que le temps écoulé/);
    expect(await passagesDe(E, video)).toBe("{[0,60)}");
  });

  it("sans « commencer », rien n'est enregistré", async () => {
    await expect(enregistrer(F, video, "{[0,5)}")).rejects.toThrow(/non commencé/);
  });

  it("les passages au-delà de la durée sont coupés", async () => {
    await reculer(E, video, 400);
    expect(await enregistrer(E, video, "{[360,500)}")).toMatchObject({ secondes_vues: 70 });
  });

  it("la leçon est validée au seuil (90 %), et le reste", async () => {
    await reculer(E, video, 400);
    expect(await enregistrer(E, video, "{[60,330)}")).toEqual({ secondes_vues: 340, reference: 370, terminee: true });
    const { rows } = await banc.db.query<{ t: string }>("select terminee_le::text as t from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, video]);
    await reculer(E, video, 10);
    expect(await enregistrer(E, video, "{[0,5)}")).toMatchObject({ terminee: true });
    const apres = await banc.db.query<{ t: string }>("select terminee_le::text as t from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, video]);
    expect(apres.rows[0].t).toBe(rows[0].t);
  });

  it("la durée annoncée par le lecteur sert de référence si elle vaut au moins la moitié de celle de la leçon", async () => {
    await commencer(F, video);
    await reculer(F, video, 30);
    expect(await enregistrer(F, video, "{[0,10)}", 10, 300)).toMatchObject({ reference: 300 });
    await reculer(F, video, 30);
    expect(await enregistrer(F, video, "{[10,20)}", 20, 100)).toMatchObject({ reference: 370 });
  });

  it("leçon fermée, visiteur ou leçon sans vidéo : refusé", async () => {
    await expect(commencer(E, fermee)).rejects.toThrow(/inaccessible/);
    await expect(banc.en("anon", "select public.commencer_visionnage($1)", [video])).rejects.toThrow();
    await commencer(E, sansVideo);
    await reculer(E, sansVideo, 30);
    await expect(enregistrer(E, sansVideo, "{[0,5)}")).rejects.toThrow(/pas de vidéo/);
  });

  it("chacun ne voit que son visionnage, et personne n'écrit directement dans la table", async () => {
    expect(await banc.en({ id: F }, "select lecon_id from public.progression_lecons where profil_id = $1", [E])).toEqual([]);
    expect((await banc.en({ id: E }, "select lecon_id from public.progression_lecons")).length).toBeGreaterThan(0);
    await expect(banc.en({ id: E }, "update public.progression_lecons set terminee_le = now()")).rejects.toThrow();
    await expect(banc.en({ id: F }, "insert into public.progression_lecons (lecon_id, passages) values ($1, '{[0,370)}')", [sansVideo])).rejects.toThrow();
  });

  it("la migration se rejoue sans perdre le visionnage", async () => {
    await banc.appliquer(MIGRATION);
    expect(await passagesDe(E, video)).toBe("{[0,330),[360,370)}");
  });
});
