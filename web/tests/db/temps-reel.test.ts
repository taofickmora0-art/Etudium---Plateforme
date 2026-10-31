import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0044 (liste du 31 octobre 2026 : les notifications en temps réel) : la base prévient aussitôt les appareils
// concernés, par le temps réel de Supabase (realtime.send, sur des sujets privés) : « compte:<id> » pour ses
// notifications et ses messages, « communaute » pour une publication qui paraît. Rien n'est diffusé du contenu : l'appli
// relit ce qui la concerne, avec ses droits. Sans le temps réel (banc ordinaire), tout marche comme avant.

const MIGRATIONS = [
  ...MIGRATIONS_LOT_0,
  ...[
    "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
    "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
    "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
    "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
    "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
    "0035_messagerie", "0036_formateur_sans_espace_etudiant", "0037_reponses_aux_reponses", "0038_photos_communaute", "0039_annonce_masquable",
    "0040_photos_colonne_communaute", "0041_notifications_communaute", "0042_nouvelles_publications", "0043_nouvelles_publications_siennes",
  ].map((m) => `supabase/migrations/${m}.sql`),
];
const TEMPS_REEL = "supabase/migrations/0044_temps_reel.sql";

let banc: Banc;
const S = randomUUID(); // super admin (équipe)
const A = randomUUID(); // admin (équipe)
const F = randomUUID(); // formateur
const E = randomUUID(); // étudiante
const X = randomUUID(); // autre étudiant

type Envoi = { topic: string; event: string };
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const envois = async (sujet?: string) =>
  (await banc.db.query<Envoi>(
    "select topic, event from realtime.messages where ($1::text is null or topic = $1) order by id",
    [sujet ?? null],
  )).rows;
const sujets = async (evenement: string) => (await envois()).filter((e) => e.event === evenement).map((e) => e.topic).sort();
const compte = (id: string) => `compte:${id}`;
const notifier = (dest: string[]) =>
  banc.db.query("select public.notifier($1::uuid[], 'communaute', 'Titre', 'Texte', '/communaute', false)", [dest]);
const poster = async (o: { il_y_a?: number; statut?: string; ecrite?: number } = {}) =>
  (await un<{ id: string }>(
    `insert into public.publications (auteur, texte, statut, cree_le, ecrite_le)
     values ($1, 'Bonjour', $2, now() - make_interval(secs => $3), now() - make_interval(secs => $3 + $4)) returning id`,
    [E, o.statut ?? "publiee", o.il_y_a ?? 0, o.ecrite ?? 0],
  )).id;

beforeAll(async () => {
  banc = await creerBanc([...MIGRATIONS, "tests/db/realtime-simule.sql", TEMPS_REEL]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [E, []], [X, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
});

beforeEach(async () => {
  await banc.db.query("delete from public.messages");
  await banc.db.query("delete from public.conversations");
  await banc.db.query("delete from public.publications");
  await banc.db.query("delete from public.notifications");
  await banc.db.query("delete from realtime.messages");
});

describe("Les notifications", () => {
  it("chaque destinataire est prévenu sur son sujet, une fois par envoi ; une lecture prévient ses autres appareils", async () => {
    await notifier([E, X]);
    expect(await sujets("notification")).toEqual([compte(E), compte(X)].sort());
    expect(await envois()).toHaveLength(2);
    await notifier([E]);
    await banc.db.query("delete from realtime.messages");
    // « Tout marquer comme lu » : une seule diffusion pour ses deux notifications.
    await banc.db.query("update public.notifications set lue_le = now() where destinataire = $1", [E]);
    expect(await envois()).toEqual([{ topic: compte(E), event: "notification" }]);
  });
});

describe("Les messages", () => {
  it("un message prévient les deux côtés de la conversation ; la lire aussi, une fois (la relire : rien, pas de boucle)", async () => {
    const conv = (await un<{ id: string }>(
      "insert into public.conversations (etudiant_id, formateur_id, dernier_message_le, lu_autre_le) values ($1, $2, now(), now() - interval '1 hour') returning id",
      [E, F],
    )).id;
    await banc.db.query("insert into public.messages (conversation_id, auteur_id, de_etudiant, texte) values ($1, $2, true, 'Bonjour')", [conv, E]);
    expect(await sujets("message")).toEqual([compte(E), compte(F)].sort());
    await banc.db.query("delete from realtime.messages");
    // Le formateur ouvre la conversation (fil_conversation la marque lue) : ses autres appareils suivent.
    await banc.db.query("update public.conversations set lu_autre_le = now() + interval '1 second' where id = $1", [conv]);
    expect(await sujets("message")).toEqual([compte(E), compte(F)].sort());
    await banc.db.query("delete from realtime.messages");
    // Chaque relecture la marque lue encore : rien de nouveau, rien n'est diffusé.
    await banc.db.query("update public.conversations set lu_autre_le = now() + interval '2 seconds' where id = $1", [conv]);
    expect(await envois()).toEqual([]);
  });

  it("l'assistance : l'étudiante et toute l'équipe", async () => {
    const conv = (await un<{ id: string }>("insert into public.conversations (etudiant_id, formateur_id) values ($1, null) returning id", [E])).id;
    await banc.db.query("insert into public.messages (conversation_id, auteur_id, de_etudiant, texte) values ($1, $2, true, 'Aide')", [conv, E]);
    expect(await sujets("message")).toEqual([compte(A), compte(E), compte(S)].sort());
  });
});

describe("Les publications", () => {
  it("une publication parue prévient la communauté ; programmée à venir ou en attente : rien", async () => {
    await poster();
    expect(await envois("communaute")).toEqual([{ topic: "communaute", event: "publication" }]);
    await banc.db.query("delete from realtime.messages");
    await poster({ il_y_a: -3600, ecrite: 60 });
    await poster({ statut: "en_attente" });
    expect(await envois("communaute")).toEqual([]);
  });

  it("validée par l'équipe, ou programmée et parue à l'heure : la communauté est prévenue", async () => {
    const attente = await poster({ statut: "en_attente" });
    await banc.db.query("update public.publications set statut = 'publiee' where id = $1", [attente]);
    expect(await envois("communaute")).toEqual([{ topic: "communaute", event: "publication" }]);
    await banc.db.query("delete from realtime.messages");
    // Écrite il y a deux heures pour paraître il y a une minute : la tâche planifiée (0041) la marque parue.
    await poster({ il_y_a: 60, ecrite: 7200 });
    await banc.db.query("delete from realtime.messages");
    await banc.db.query("select public.traiter_publications_programmees()");
    expect(await envois("communaute")).toEqual([{ topic: "communaute", event: "publication" }]);
  });
});

describe("Qui peut s'abonner", () => {
  const voit = async (qui: string | "anon", sujet: string) => {
    await banc.db.query("select set_config('realtime.topic', $1, false)", [sujet]);
    const [r] = await banc.en<{ n: number }>(qui === "anon" ? "anon" : { id: qui }, "select count(*)::int as n from realtime.messages");
    await banc.db.query("select set_config('realtime.topic', '', false)");
    return r.n > 0;
  };

  it("chacun son sujet et la communauté ; ni celui d'un autre, ni un visiteur", async () => {
    await notifier([E]);
    await poster();
    expect(await voit(E, compte(E))).toBe(true);
    expect(await voit(E, "communaute")).toBe(true);
    expect(await voit(E, compte(X))).toBe(false);
    expect(await voit(E, "autre-sujet")).toBe(false);
    expect(await voit("anon", "communaute")).toBe(false);
  });
});

describe("Sans le temps réel de Supabase", () => {
  it("la migration passe, et notifications, messages et publications marchent comme avant", async () => {
    const ordinaire = await creerBanc([...MIGRATIONS, TEMPS_REEL]);
    const Y = randomUUID();
    await ordinaire.creerCompte(Y);
    await ordinaire.db.query("select public.notifier($1::uuid[], 'communaute', 'Titre', 'Texte', '/x', false)", [[Y]]);
    await ordinaire.db.query("insert into public.publications (auteur, texte) values ($1, 'Bonjour')", [Y]);
    const conv = (await ordinaire.db.query<{ id: string }>("insert into public.conversations (etudiant_id, formateur_id) values ($1, null) returning id", [Y])).rows[0].id;
    await ordinaire.db.query("insert into public.messages (conversation_id, auteur_id, de_etudiant, texte) values ($1, $2, true, 'Aide')", [conv, Y]);
    expect((await ordinaire.db.query("select 1 from public.notifications where destinataire = $1", [Y])).rows).toHaveLength(1);
  });
});
