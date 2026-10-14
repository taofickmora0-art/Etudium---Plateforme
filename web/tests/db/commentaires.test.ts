import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0025 (communauté v3, étape 2) : répondre à un commentaire (un seul niveau), J’aime, modifier.

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const E1 = randomUUID(); // « Koffi Dossou »
const E2 = randomUUID(); // « Awa Sow »
const E3 = randomUUID();

const publier = async (qui: string) => (await banc.en<{ id: string }>({ id: qui }, "select (public.publier(null, '', 'Bonjour', null) ->> 'id')::uuid as id"))[0].id;
const commenter = async (qui: string, publication: string, texte: string, parent: string | null = null) =>
  (await banc.en<{ id: string }>({ id: qui }, "select public.commenter($1, $2, $3) as id", [publication, texte, parent]))[0].id;
type Carte = { id: string; parent_id: string | null; texte: string; reactions: number; j_aime: boolean; modifie: boolean; peut_modifier: boolean };
type Detail = { reponses: number; dernieres_reponses: Carte[]; toutes_reponses: Carte[] };
const detail = async (qui: string, publication: string) => (await banc.en<{ d: Detail }>({ id: qui }, "select public.publication_communaute($1) as d", [publication]))[0].d;
const recues = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string }>("select titre, texte from public.notifications where destinataire = $1 and categorie = 'communaute' order by id", [qui])).rows;

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
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [E1, []], [E2, []], [E3, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Koffi', nom = 'Dossou' where id = $1", [E1]);
  await banc.db.query("update public.profils set prenom = 'Awa', nom = 'Sow' where id = $1", [E2]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.publications");
  await banc.db.query("delete from public.notifications");
});

describe("Répondre à un commentaire", () => {
  it("la réponse est rattachée au commentaire ; répondre à une réponse la rattache au même commentaire (un seul niveau)", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Très bon plan.");
    const r1 = await commenter(E2, pub, "D’accord !", c);
    const r2 = await commenter(E3, pub, "@Awa S. oui", r1);
    const toutes = (await detail(E1, pub)).toutes_reponses;
    expect(toutes.find((x) => x.id === r1)?.parent_id).toBe(c);
    expect(toutes.find((x) => x.id === r2)?.parent_id).toBe(c);
    expect(toutes.find((x) => x.id === c)?.parent_id).toBeNull();
  });

  it("un commentaire d'une autre publication, ou inconnu : refusé", async () => {
    const pub = await publier(E3);
    const autre = await publier(E3);
    const c = await commenter(E1, autre, "Ailleurs");
    await expect(commenter(E2, pub, "Réponse", c)).rejects.toThrow("Ce commentaire n’existe plus.");
    await expect(commenter(E2, pub, "Réponse", randomUUID())).rejects.toThrow("Ce commentaire n’existe plus.");
  });

  it("l'auteur du commentaire est prévenu d'une réponse (pas de lui-même)", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Question ?");
    await commenter(E2, pub, "Réponse.", c);
    await commenter(E1, pub, "Merci", c);
    expect(await recues(E1)).toEqual([{ titre: "Nouvelle réponse à votre commentaire", texte: "Awa S. a répondu à votre commentaire dans l’espace général." }]);
  });

  it("supprimer un commentaire supprime ses réponses", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Parent");
    await commenter(E2, pub, "Enfant", c);
    await banc.en({ id: E1 }, "select public.supprimer_commentaire($1)", [c]);
    expect((await detail(E3, pub)).toutes_reponses).toEqual([]);
  });
});

describe("J’aime et modifier", () => {
  it("J’aime : ajouté puis retiré ; la carte rend le nombre et mon état", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "À aimer");
    const bascule = async (qui: string) => (await banc.en<{ r: { j_aime: boolean; reactions: number } }>({ id: qui }, "select public.basculer_reaction_commentaire($1) as r", [c]))[0].r;
    expect(await bascule(E2)).toEqual({ j_aime: true, reactions: 1 });
    expect(await bascule(E3)).toEqual({ j_aime: true, reactions: 2 });
    expect(await bascule(E2)).toEqual({ j_aime: false, reactions: 1 });
    const carte = (await detail(E3, pub)).toutes_reponses[0];
    expect(carte).toMatchObject({ reactions: 1, j_aime: true });
  });

  it("modifier : l'auteur et l'équipe ; un autre compte refusé ; « modifie » et peut_modifier", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Texte");
    await banc.en({ id: E1 }, "select public.modifier_commentaire($1, $2)", [c, "Texte corrigé"]);
    await expect(banc.en({ id: E2 }, "select public.modifier_commentaire($1, $2)", [c, "Piraté"])).rejects.toThrow("Ce commentaire n’est pas le vôtre.");
    await banc.en({ id: S }, "select public.modifier_commentaire($1, $2)", [c, "Corrigé par l’équipe"]);
    const vu = async (qui: string) => (await detail(qui, pub)).toutes_reponses[0];
    expect(await vu(E1)).toMatchObject({ texte: "Corrigé par l’équipe", modifie: true, peut_modifier: true });
    expect(await vu(E2)).toMatchObject({ peut_modifier: false });
    await expect(banc.en({ id: E1 }, "select public.modifier_commentaire($1, $2)", [c, "  "])).rejects.toThrow("Écrivez votre commentaire (1 000 caractères au plus).");
  });
});

describe("Revue de l'étape 2", () => {
  it("supprimer un commentaire rend le nombre de commentaires retirés (lui et ses réponses)", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Parent");
    await commenter(E2, pub, "Enfant 1", c);
    await commenter(E3, pub, "Enfant 2", c);
    const { n } = (await banc.en<{ n: number }>({ id: E1 }, "select public.supprimer_commentaire($1) as n", [c]))[0];
    expect(n).toBe(3);
  });

  it("modifier sans changer le texte ne marque pas « modifié »", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Pareil");
    await banc.en({ id: E1 }, "select public.modifier_commentaire($1, $2)", [c, " Pareil "]);
    expect((await detail(E1, pub)).toutes_reponses[0]).toMatchObject({ modifie: false });
  });

  it("la notification de l'auteur de la publication mène au commentaire", async () => {
    const pub = await publier(E3);
    const c = await commenter(E1, pub, "Bonjour");
    const { lien } = (await banc.db.query<{ lien: string }>("select lien from public.notifications where destinataire = $1 order by id desc limit 1", [E3])).rows[0];
    expect(lien).toBe(`/communaute/publications/${pub}#commentaire-${c}`);
  });
});

describe("La carte du fil", () => {
  it("les 2 derniers commentaires de premier niveau ; le total compte aussi les réponses", async () => {
    const pub = await publier(E3);
    const a = await commenter(E1, pub, "A");
    const b = await commenter(E2, pub, "B");
    await commenter(E1, pub, "réponse à B", b);
    const c = await commenter(E3, pub, "C");
    await commenter(E2, pub, "réponse à C", c);
    const d = await detail(E1, pub);
    expect(d.reponses).toBe(5);
    expect(d.dernieres_reponses.map((x) => x.id)).toEqual([b, c]);
    expect(d.dernieres_reponses.every((x) => x.parent_id === null)).toBe(true);
    expect(d.dernieres_reponses.map((x) => x.id)).not.toContain(a);
  });
});
