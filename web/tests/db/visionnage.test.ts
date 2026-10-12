import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0007 : temps réellement regardé (spec du lot 1, §5). La base refuse un passage plus long que le temps
// écoulé et valide la leçon au seuil de la formation (90 % par défaut).
const MIGRATION = "supabase/migrations/0007_visionnage.sql";

type Resultat = { secondes_vues: number; reference: number; terminee: boolean; passages: string };

describe("Migration 0007 : visionnage", () => {
  let banc: Banc;
  const E = randomUUID();
  const F = randomUUID();
  let video: string;
  let sansVideo: string;
  let fermee: string;

  const idLecon = async (titre: string) => (await banc.db.query<{ id: string }>("select id from public.lecons where titre = $1", [titre])).rows[0].id;
  const commencer = (qui: string, lecon: string) => banc.en({ id: qui }, "select public.commencer_visionnage($1)", [lecon]);
  const enregistrer = async (qui: string, lecon: string, passages: string, position = 0) =>
    (await banc.en<{ r: Resultat }>({ id: qui }, "select public.enregistrer_visionnage($1, $2::int4multirange, $3) as r", [lecon, passages, position]))[0].r;
  /** Regarde de `debut` à `fin` en envois de 20 s, chacun 10 s après le précédent (vitesse 2×). */
  const regarder = async (qui: string, lecon: string, debut: number, fin: number) => {
    let r: Resultat | null = null;
    for (let s = debut; s < fin; s += 20) {
      await reculer(qui, lecon, 10);
      r = await enregistrer(qui, lecon, `{[${s},${Math.min(s + 20, fin)})}`);
    }
    return r!;
  };
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
    expect(await enregistrer(E, video, "{[0,40)}", 40)).toEqual({ secondes_vues: 40, reference: 370, terminee: false, passages: "{[0,40)}" });
    await reculer(E, video, 30);
    expect(await enregistrer(E, video, "{[20,60)}", 60)).toMatchObject({ secondes_vues: 60 });
    expect(await passagesDe(E, video)).toBe("{[0,60)}");
  });

  it("un envoi plus long que le temps écoulé est refusé (vitesse 2× au plus)", async () => {
    await reculer(E, video, 30);
    await expect(enregistrer(E, video, "{[60,360)}")).rejects.toThrow(/plus long que le temps écoulé/);
    expect(await passagesDe(E, video)).toBe("{[0,60)}");
  });

  it("des envois rapprochés ne créent pas de temps : la réserve ne grandit qu'avec le temps réellement écoulé", async () => {
    // Un script qui enverrait 3 s toutes les quelques millisecondes : refusé dès le premier envoi sans réserve.
    await commencer(F, video);
    await expect(enregistrer(F, video, "{[0,3)}")).rejects.toThrow(/plus long que le temps écoulé/);
    // Une longue absence ne donne pas plus de 60 s d'avance.
    await reculer(F, video, 3600);
    await expect(enregistrer(F, video, "{[0,61)}")).rejects.toThrow(/plus long que le temps écoulé/);
    expect(await enregistrer(F, video, "{[0,60)}")).toMatchObject({ secondes_vues: 60 });
    // Rappeler « commencer » ne regonfle pas la réserve.
    await commencer(F, video);
    await expect(enregistrer(F, video, "{[60,70)}")).rejects.toThrow(/plus long que le temps écoulé/);
  });

  it("renvoyer un passage déjà enregistré ne coûte rien (réponse perdue, deuxième onglet)", async () => {
    expect(await enregistrer(F, video, "{[0,60)}")).toMatchObject({ secondes_vues: 60 });
  });

  it("sans « commencer », rien n'est enregistré", async () => {
    const G = randomUUID();
    await banc.creerCompte(G);
    await expect(enregistrer(G, video, "{[0,5)}")).rejects.toThrow(/non commencé/);
  });

  it("les passages au-delà de la durée sont coupés", async () => {
    await reculer(E, video, 400);
    expect(await enregistrer(E, video, "{[360,500)}")).toMatchObject({ secondes_vues: 70 });
  });

  it("la leçon est validée au seuil (90 %), et le reste", async () => {
    expect(await regarder(E, video, 60, 330)).toMatchObject({ secondes_vues: 340, reference: 370, terminee: true });
    const { rows } = await banc.db.query<{ t: string }>("select terminee_le::text as t from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, video]);
    await reculer(E, video, 10);
    expect(await enregistrer(E, video, "{[0,5)}")).toMatchObject({ terminee: true });
    const apres = await banc.db.query<{ t: string }>("select terminee_le::text as t from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, video]);
    expect(apres.rows[0].t).toBe(rows[0].t);
  });

  it("la durée de référence est celle de la leçon ; une leçon sans durée ne se valide pas (refus explicite)", async () => {
    await reculer(F, video, 30);
    expect(await enregistrer(F, video, "{[60,70)}")).toMatchObject({ reference: 370 });
    await banc.db.query("update public.lecons set duree_secondes = 0 where id = $1", [video]);
    await reculer(F, video, 30);
    await expect(enregistrer(F, video, "{[70,80)}")).rejects.toThrow(/durée de la leçon/);
    await banc.db.query("update public.lecons set duree_secondes = 370 where id = $1", [video]);
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
