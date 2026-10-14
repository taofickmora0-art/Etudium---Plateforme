import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0026 (spec sondages, quiz et programmation) : une publication programmée, invisible des autres jusqu'à son
// heure ; sondages (texte, images) et quiz, sans fuite des résultats ni de la bonne réponse.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const A = randomUUID(); // auteur
const M = randomUUID(); // membre

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
type Option = { id: string; texte: string; image: { chemin: string } | null; votes: number | null; correcte?: boolean; moi: boolean };
type Bloc = { type: string; choix_multiples: boolean; ferme: boolean; a_repondu: boolean; votants: number | null; options: Option[]; explication?: string | null };
type Carte = { id: string; programmee: boolean; sondage: Bloc | null };

async function publier(qui: string, o: { texte?: string; publieLe?: string | null; sondage?: unknown; piece?: unknown } = {}) {
  const ligne = (
    await banc.en<{ r: { id: string } }>(
      { id: qui },
      "select public.publier(null, '', $1, $2::jsonb, null, null, null, $3::timestamptz, $4::jsonb) as r",
      [o.texte ?? "Question ?", o.piece ? JSON.stringify(o.piece) : null, o.publieLe ?? null, o.sondage ? JSON.stringify(o.sondage) : null],
    )
  )[0];
  return ligne.r.id;
}
const dans = async (intervalle: string) => (await un<{ t: string }>("select (now() + $1::interval)::text as t", [intervalle])).t;
const carte = async (qui: string, id: string) => (await banc.en<{ c: Carte | null }>({ id: qui }, "select public.publication_communaute($1) as c", [id]))[0].c;
const fil = async (qui: string, tri = "recentes") =>
  (await banc.en<{ f: { publications: { id: string }[] } }>({ id: qui }, "select public.fil_communaute('tous', $1) as f", [tri]))[0].f.publications.map((p) => p.id);
const voter = async (qui: string, id: string, options: string[]) =>
  (await banc.en<{ b: Bloc }>({ id: qui }, "select public.voter($1, $2::uuid[]) as b", [id, `{${options.join(",")}}`]))[0].b;
const sondage = (o: Record<string, unknown> = {}) => ({ type: "texte", choix_multiples: false, duree_jours: 7, options: [{ texte: "Oui" }, { texte: "Non" }], ...o });
const quiz = (o: Record<string, unknown> = {}) => ({
  type: "quiz",
  explication: "Paris est la capitale de la France.",
  options: [{ texte: "Lyon" }, { texte: "Paris", correcte: true }, { texte: "Nice" }],
  ...o,
});
async function deposer(qui: string, type = "image/png") {
  const chemin = `${qui}/${randomUUID()}.png`;
  await banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('communaute', $1, $2, $3::jsonb)", [chemin, qui, JSON.stringify({ mimetype: type, size: 2048 })]);
  return { chemin, nom: "image.png", type, taille: 2048 };
}

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
    "supabase/migrations/0022_communaute_video.sql",
    "supabase/migrations/0023_sessions_rappels.sql",
    "supabase/migrations/0024_sessions_promotion.sql",
    "supabase/migrations/0025_communaute_commentaires.sql",
    "supabase/migrations/0026_communaute_sondages.sql",
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, []], [M, []]] as const) await banc.creerCompte(id, [...roles]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.publications");
});

describe("Publications programmées", () => {
  it("invisibles des autres et sans interaction jusqu'à l'heure ; l'auteur les retrouve dans « programmees »", async () => {
    const id = await publier(A, { publieLe: await dans("2 hours") });
    expect(await fil(M)).not.toContain(id);
    expect(await fil(A)).not.toContain(id);
    expect(await fil(A, "programmees")).toEqual([id]);
    expect(await fil(M, "programmees")).toEqual([]);
    expect(await carte(M, id)).toBeNull();
    expect((await carte(A, id))?.programmee).toBe(true);
    await expect(banc.en({ id: M }, "select public.commenter($1, 'Hé')", [id])).rejects.toThrow("Cette publication n’existe plus.");
    await expect(banc.en({ id: A }, "select public.basculer_reaction($1)", [id])).rejects.toThrow("Cette publication n’est pas encore parue.");
    // À l'heure : en ligne pour tous.
    await banc.db.query("update public.publications set cree_le = now() - interval '1 minute' where id = $1", [id]);
    expect(await fil(M)).toContain(id);
    expect((await carte(M, id))?.programmee).toBe(false);
  });

  it("de 10 minutes à 3 mois à l'avance", async () => {
    await expect(publier(A, { publieLe: await dans("2 minutes") })).rejects.toThrow("Choisissez une heure au moins 10 minutes plus tard.");
    await expect(publier(A, { publieLe: await dans("4 months") })).rejects.toThrow("Choisissez une date dans les 3 mois qui viennent.");
  });

  it("la limite de débit compte une programmée quand on l'écrit, pas jusqu'à sa parution (revue finale, C1)", async () => {
    for (let jour = 1; jour <= 5; jour++) await publier(A, { publieLe: await dans(`${jour} days`) });
    await expect(publier(A)).rejects.toThrow("Vous publiez beaucoup en peu de temps.");
    // Onze minutes plus tard (simulé) : l'auteur publie de nouveau, sans attendre la parution des programmées.
    await banc.db.query("update public.publications set ecrite_le = now() - interval '11 minutes'");
    expect(await publier(A)).toBeTruthy();
  });

  it("absentes des tendances et des activités récentes", async () => {
    const id = await publier(A, { publieLe: await dans("1 hour") });
    await banc.db.query("insert into public.reactions_publications (publication_id, profil_id) values ($1, $2)", [id, M]);
    const tendances = (await banc.en<{ t: { id: string }[] }>({ id: M }, "select public.publications_tendances() as t"))[0].t ?? [];
    expect(tendances.map((t) => t.id)).not.toContain(id);
    const activites = (await banc.en<{ a: { publication_id: string }[] }>({ id: M }, "select public.activites_recentes() as a"))[0].a ?? [];
    expect(activites.map((a) => a.publication_id)).not.toContain(id);
  });

  it("reprogrammer : l'auteur change l'heure ou publie maintenant ; un autre compte, non ; parue, non", async () => {
    const id = await publier(A, { publieLe: await dans("2 hours") });
    await expect(banc.en({ id: M }, "select public.reprogrammer($1, null)", [id])).rejects.toThrow("Cette publication n’est pas la vôtre.");
    await banc.en({ id: A }, "select public.reprogrammer($1, $2::timestamptz)", [id, await dans("5 hours")]);
    expect(await fil(M)).not.toContain(id);
    await banc.en({ id: A }, "select public.reprogrammer($1, null)", [id]);
    expect(await fil(M)).toContain(id);
    await expect(banc.en({ id: A }, "select public.reprogrammer($1, null)", [id])).rejects.toThrow("Cette publication est déjà parue.");
  });
});

describe("Sondages", () => {
  it("avant de voter : les options sans résultats ; voter, puis changer son vote ; une seule réponse", async () => {
    const id = await publier(A, { sondage: sondage() });
    const avant = (await carte(M, id))!.sondage!;
    expect(avant).toMatchObject({ type: "texte", a_repondu: false, ferme: false, votants: null });
    expect(avant.options.map((o) => [o.texte, o.votes])).toEqual([["Oui", null], ["Non", null]]);
    const [oui, non] = avant.options.map((o) => o.id);
    let bloc = await voter(M, id, [oui]);
    expect(bloc).toMatchObject({ a_repondu: true, votants: 1 });
    expect(bloc.options.map((o) => [o.votes, o.moi])).toEqual([[1, true], [0, false]]);
    bloc = await voter(M, id, [non]);
    expect(bloc.options.map((o) => o.votes)).toEqual([0, 1]);
    await expect(voter(M, id, [oui, non])).rejects.toThrow("Choisissez une seule réponse.");
    // L'auteur voit les résultats sans voter.
    expect((await carte(A, id))!.sondage!.options.map((o) => o.votes)).toEqual([0, 1]);
  });

  it("plusieurs réponses permises ; terminé : plus de vote, les résultats pour tous", async () => {
    const id = await publier(A, { sondage: sondage({ choix_multiples: true, options: [{ texte: "A" }, { texte: "B" }, { texte: "C" }] }) });
    const [a, b] = (await carte(M, id))!.sondage!.options.map((o) => o.id);
    expect((await voter(M, id, [a, b])).options.filter((o) => o.moi)).toHaveLength(2);
    await banc.db.query("update public.sondages set fin_le = now() - interval '1 minute' where publication_id = $1", [id]);
    await expect(voter(M, id, [a])).rejects.toThrow("Ce sondage est terminé.");
    expect((await carte(S, id))!.sondage).toMatchObject({ ferme: true });
  });

  it("2 à 10 options de 80 caractères ; un seul ajout par publication", async () => {
    await expect(publier(A, { sondage: sondage({ options: [{ texte: "Seule" }] }) })).rejects.toThrow("Un sondage a de 2 à 10 options.");
    await expect(publier(A, { sondage: sondage({ options: Array.from({ length: 11 }, (_, i) => ({ texte: `O${i}` })) }) })).rejects.toThrow(
      "Un sondage a de 2 à 10 options.",
    );
    await expect(publier(A, { sondage: sondage({ options: [{ texte: "x".repeat(81) }, { texte: "B" }] }) })).rejects.toThrow("Une option fait 80 caractères au plus.");
    await expect(publier(A, { sondage: sondage(), piece: await deposer(A) })).rejects.toThrow(
      "Une publication porte un seul ajout : une image, un fichier, une vidéo, un sondage ou un quiz.",
    );
  });

  it("sondage avec images : les images du dossier de l'auteur, lisibles par les membres ; celle d'un autre refusée", async () => {
    const [i1, i2] = [await deposer(A), await deposer(A)];
    const id = await publier(A, { sondage: sondage({ type: "images", options: [{ texte: "Rouge", image: i1 }, { image: i2 }] }) });
    const options = (await carte(M, id))!.sondage!.options;
    expect(options.map((o) => o.image?.chemin)).toEqual([i1.chemin, i2.chemin]);
    expect((await banc.en<{ l: boolean }>({ id: M }, "select public.fichier_communaute_lisible($1) as l", [i1.chemin]))[0].l).toBe(true);
    expect((await banc.en<{ i: string[] }>({ id: A }, "select public.images_sondage($1) as i", [id]))[0].i).toEqual([i1.chemin, i2.chemin]);
    await expect(publier(A, { sondage: sondage({ type: "images", options: [{ image: await deposer(M) }, { image: await deposer(A) }] }) })).rejects.toThrow(
      "Ce fichier n’est pas le vôtre.",
    );
    await expect(publier(A, { sondage: sondage({ type: "images", options: [{ texte: "Sans image" }, { image: await deposer(A) }] }) })).rejects.toThrow(
      "Chaque option d’un sondage avec images a son image.",
    );
  });
});

describe("Quiz", () => {
  it("la bonne réponse et l'explication n'arrivent qu'après la réponse ; réponse définitive", async () => {
    const id = await publier(A, { sondage: quiz() });
    const avant = (await carte(M, id))!.sondage!;
    expect(avant.options.every((o) => o.correcte === undefined)).toBe(true);
    expect(avant.explication).toBeUndefined();
    const lyon = avant.options[0].id;
    const apres = await voter(M, id, [lyon]);
    expect(apres.options.map((o) => [o.texte, o.correcte, o.moi])).toEqual([
      ["Lyon", false, true],
      ["Paris", true, false],
      ["Nice", false, false],
    ]);
    expect(apres.explication).toBe("Paris est la capitale de la France.");
    await expect(voter(M, id, [apres.options[1].id])).rejects.toThrow("Vous avez déjà répondu à ce quiz.");
    // L'auteur connaît la réponse.
    expect((await carte(A, id))!.sondage!.options[1].correcte).toBe(true);
  });

  it("une seule bonne réponse, 2 à 6 réponses", async () => {
    await expect(publier(A, { sondage: quiz({ options: [{ texte: "A" }, { texte: "B" }] }) })).rejects.toThrow("Un quiz a une seule bonne réponse.");
    await expect(publier(A, { sondage: quiz({ options: [{ texte: "A", correcte: true }, { texte: "B", correcte: true }] }) })).rejects.toThrow(
      "Un quiz a une seule bonne réponse.",
    );
    await expect(publier(A, { sondage: quiz({ options: Array.from({ length: 7 }, (_, i) => ({ texte: `R${i}`, correcte: i === 0 })) }) })).rejects.toThrow(
      "Un quiz a de 2 à 6 réponses.",
    );
  });
});
