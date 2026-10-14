import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0020 : la modération (spec 2026-10-14-moderation). La base n'applique un verdict de l'IA que s'il porte le
// jeton de modération ; analyse active, une publication sans verdict valide attend l'équipe.
const MIGRATION = "supabase/migrations/0020_moderation.sql";
const REFUS = /row-level security|permission denied|Réservé à l’équipe/;
const TROP_VITE = "Vous publiez beaucoup en peu de temps. Réessayez dans quelques minutes.";

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
const F = randomUUID(); // formateur de X (parcours P)
const E1 = randomUUID(); // suit X
const E2 = randomUUID(); // ne suit rien
let FA: string;
let P: string;
let X: string;
let JETON: string;

type Resultat = { id: string; statut: string; categorie: string | null };
type Carte = { id: string; statut: string; texte: string; peut_signaler: boolean; dernieres_reponses: { id: string; peut_signaler: boolean }[] };
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const json = (v: unknown) => (v === null ? null : JSON.stringify(v));
const publier = async (qui: string, espace: string | null, texte = "Bonjour", analyse: unknown = null, piece: unknown = null) =>
  (await banc.en<{ r: Resultat }>({ id: qui }, "select public.publier($1, '', $2, $3::jsonb, $4::jsonb) as r", [espace, texte, json(piece), json(analyse)]))[0].r;
const modifier = async (qui: string, id: string, texte: string, analyse: unknown = null) =>
  (await banc.en<{ r: { statut: string; categorie: string | null } }>({ id: qui }, "select public.modifier_publication($1, '', $2, $3::jsonb) as r", [id, texte, json(analyse)]))[0].r;
const verdict = (decision: string, categorie = "aucune", raison = "Raison") => ({ jeton: JETON, decision, categorie, raison });
const activer = (oui: boolean) => banc.db.query("update public.reglages_moderation set analyse_active = $1", [oui]);
const fil = async (qui: string) =>
  (await banc.en<{ r: { publications: Carte[] } }>({ id: qui }, "select public.fil_communaute('tous') as r"))[0].r.publications;
const page = async (qui: string, id: string) => (await banc.en<{ r: Carte | null }>({ id: qui }, "select public.publication_communaute($1) as r", [id]))[0].r;
const ligne = (id: string) => un<{ statut: string; a_examiner: boolean; texte: string; analyse: Record<string, string> | null }>("select statut, a_examiner, texte, verdict as analyse from public.publications where id = $1", [id]);
const deposer = (qui: string, chemin: string, type = "image/png", taille = 1000) =>
  banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('communaute', $1, $2, $3::jsonb)", [chemin, qui, JSON.stringify({ mimetype: type, size: taille })]);
const aModerer = async () => (await un<{ n: number }>("select count(*)::int as n from public.notifications where titre = 'À modérer'")).n;

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
    MIGRATION,
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [E1, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Koffi', nom = 'Dossou' where id = $1", [E1]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, 'Réussite académique', 'Académique', 'academique', -2) returning id", [`p-${randomUUID()}`])).id;
  X = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, statut) values ('Excel', $1, $2, 'publiee') returning id", [`x-${randomUUID()}`, FA])).id;
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id) values ($1, $2)", [X, P]);
  const m = await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'M') returning id", [X]);
  const l = await un<{ id: string }>("insert into public.lecons (module_id, titre) values ($1, 'L') returning id", [m.id]);
  await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2)", [E1, l.id]);
  JETON = (await un<{ jeton: string }>("select jeton from public.reglages_moderation")).jeton;
});

beforeEach(async () => {
  await banc.db.query("delete from public.publications");
  await banc.db.query("delete from public.notifications");
  await activer(false);
});

describe("Publications analysées", () => {
  it("analyse inactive : publier sans verdict publie ; un verdict au mauvais jeton est ignoré", async () => {
    expect(JETON).toMatch(/^[0-9a-f]{64}$/);
    const r = await publier(E1, null);
    expect(r.statut).toBe("publiee");
    const faux = await publier(E1, null, "Arnaque", { ...verdict("bloquer", "arnaque"), jeton: "faux" });
    expect(faux.statut).toBe("publiee");
    expect((await ligne(faux.id)).analyse).toBeNull();
  });

  it("regler_analyse : refus sans le bon jeton ; l'équipe seule ; etat_moderation", async () => {
    await expect(banc.en({ id: E1 }, "select public.regler_analyse(true, $1)", [JETON])).rejects.toThrow(REFUS);
    await expect(banc.en({ id: A }, "select public.regler_analyse(true, 'faux')")).rejects.toThrow("Le jeton de modération n’est pas reconnu.");
    await banc.en({ id: A }, "select public.regler_analyse(true, $1)", [JETON]);
    expect((await banc.en<{ r: boolean }>({ id: E1 }, "select public.moderation_active() as r"))[0].r).toBe(true);
    type Etat = { active: boolean; jeton_reconnu: boolean | null; derniere_analyse: string | null; en_attente: number };
    const etat = async (jeton: string | null) => (await banc.en<{ r: Etat }>({ id: A }, "select public.etat_moderation($1) as r", [jeton]))[0].r;
    expect(await etat(JETON)).toEqual({ active: true, jeton_reconnu: true, derniere_analyse: null, en_attente: 0 });
    expect((await etat("faux")).jeton_reconnu).toBe(false);
    expect((await etat(null)).jeton_reconnu).toBeNull();
    await publier(E1, null, "Sans verdict");
    expect((await etat(JETON)).en_attente).toBe(1);
    await expect(banc.en({ id: E1 }, "select public.etat_moderation(null)")).rejects.toThrow(REFUS);
    await banc.en({ id: A }, "select public.regler_analyse(false, null)");
    expect((await etat(null)).active).toBe(false);
  });

  it("analyse active : autoriser → publiee ; signaler et echec → publiee + a_examiner ; bloquer → bloquee ; sans verdict → en_attente", async () => {
    await activer(true);
    const ok = await publier(E1, null, "Bonjour", verdict("autoriser"));
    expect(await ligne(ok.id)).toMatchObject({ statut: "publiee", a_examiner: false, analyse: { decision: "autoriser", categorie: "aucune" } });
    expect((await un<{ d: string | null }>("select derniere_analyse as d from public.reglages_moderation")).d).not.toBeNull();
    const douteuse = await publier(E1, null, "Gagnez vite", verdict("signaler", "publicite"));
    expect(await ligne(douteuse.id)).toMatchObject({ statut: "publiee", a_examiner: true });
    const echec = await publier(E1, null, "Autre", verdict("echec"));
    expect(await ligne(echec.id)).toMatchObject({ statut: "publiee", a_examiner: true });
    const arnaque = await publier(E1, null, "Envoyez 5 000 F", verdict("bloquer", "arnaque"));
    expect(arnaque).toMatchObject({ statut: "bloquee", categorie: "arnaque" });
    expect((await ligne(arnaque.id)).statut).toBe("bloquee");
    const direct = await publier(E1, null, "Appel direct");
    expect(direct.statut).toBe("en_attente");
  });

  it("visibilité : en attente pour son auteur seul, bloquée pour personne ; l'équipe ouvre tout ; ni réponse, ni J’aime, ni fichier", async () => {
    await activer(true);
    const chemin = `${E1}/${randomUUID()}.png`;
    await deposer(E1, chemin);
    const attente = await publier(E1, null, "En attente", null, { chemin, nom: "a.png", type: "image/png", taille: 1000 });
    const bloquee = await publier(E1, null, "Arnaque", verdict("bloquer", "arnaque"));
    const ok = await publier(E1, null, "En ligne", verdict("autoriser"));
    expect((await fil(E1)).map((p) => p.id).sort()).toEqual([attente.id, ok.id].sort());
    expect((await fil(E2)).map((p) => p.id)).toEqual([ok.id]);
    expect((await fil(A)).map((p) => p.id)).toEqual([ok.id]);
    expect(await page(E2, attente.id)).toBeNull();
    expect((await page(E1, attente.id))?.statut).toBe("en_attente");
    expect(await page(E1, bloquee.id)).toBeNull();
    expect((await page(A, bloquee.id))?.statut).toBe("bloquee");
    await expect(banc.en({ id: E1 }, "select public.commenter($1, 'Oui')", [attente.id])).rejects.toThrow("Cette publication attend sa vérification.");
    await expect(banc.en({ id: E2 }, "select public.commenter($1, 'Oui')", [attente.id])).rejects.toThrow("Cette publication n’existe plus.");
    await expect(banc.en({ id: E2 }, "select public.basculer_reaction($1)", [bloquee.id])).rejects.toThrow("Cette publication n’existe plus.");
    const lit = async (qui: string) => (await banc.en({ id: qui }, "select name from storage.objects where bucket_id = 'communaute' and name = $1", [chemin])).length;
    expect([await lit(E1), await lit(E2), await lit(A)]).toEqual([1, 0, 1]);
  });

  it("modifier : bloquer garde l'ancienne version ; signaler applique + a_examiner ; sans verdict, analyse active → en_attente", async () => {
    await activer(true);
    const { id } = await publier(E1, null, "Original", verdict("autoriser"));
    expect(await modifier(E1, id, "Arnaque", verdict("bloquer", "arnaque"))).toEqual({ statut: "bloquee", categorie: "arnaque" });
    expect(await ligne(id)).toMatchObject({ statut: "publiee", texte: "Original", a_examiner: false });
    expect((await modifier(E1, id, "Douteux", verdict("signaler", "hors_sujet"))).statut).toBe("publiee");
    expect(await ligne(id)).toMatchObject({ statut: "publiee", texte: "Douteux", a_examiner: true });
    expect((await modifier(E1, id, "Direct")).statut).toBe("en_attente");
    expect(await ligne(id)).toMatchObject({ statut: "en_attente", texte: "Direct" });
  });

  it("limite : la 6e publication en 10 minutes est refusée ; la 31e réponse aussi", async () => {
    for (let i = 0; i < 5; i++) await publier(E2, null, `P${i}`);
    await expect(publier(E2, null, "Une de trop")).rejects.toThrow(TROP_VITE);
    const { id } = await publier(E1, null, "Une question");
    for (let i = 0; i < 30; i++) await banc.en({ id: E2 }, "select public.commenter($1, $2)", [id, `R${i}`]);
    await expect(banc.en({ id: E2 }, "select public.commenter($1, 'Encore')", [id])).rejects.toThrow(TROP_VITE);
  });

  it("verifier_piece : le type et la taille sont ceux enregistrés par le stockage", async () => {
    const chemin = `${E1}/${randomUUID()}.png`;
    await deposer(E1, chemin, "image/png", 1000);
    const REFUSE = "Ce fichier n’est pas le vôtre.";
    await expect(publier(E1, null, "x", null, { chemin, nom: "a.pdf", type: "application/pdf", taille: 1000 })).rejects.toThrow(REFUSE);
    await expect(publier(E1, null, "x", null, { chemin, nom: "a.png", type: "image/png", taille: 10 })).rejects.toThrow(REFUSE);
    expect((await publier(E1, null, "x", null, { chemin, nom: "a.png", type: "image/png", taille: 1000 })).statut).toBe("publiee");
  });

  it("À modérer : l'équipe est prévenue d'une publication signalée ou en attente, pas d'une autorisée ni bloquée", async () => {
    await activer(true);
    await publier(E1, P, "Bonjour", verdict("autoriser"));
    await publier(E1, P, "Arnaque", verdict("bloquer", "arnaque"));
    expect(await aModerer()).toBe(0);
    await publier(E1, P, "Douteux", verdict("signaler", "spam"));
    const notes = (await banc.db.query<{ destinataire: string; categorie: string; texte: string; lien: string }>("select destinataire, categorie, texte, lien from public.notifications where titre = 'À modérer'")).rows;
    expect(notes.map((n) => n.destinataire).sort()).toEqual([A, S].sort());
    expect(notes[0]).toMatchObject({ categorie: "service", texte: "Une publication de l’espace Académique attend votre examen.", lien: "/admin/moderation" });
    await publier(E1, null, "Sans verdict");
    expect(await aModerer()).toBe(4);
  });

  it("carte : statut et peut_signaler (faux pour l'auteur et l'équipe) ; la migration est rejouable et garde le jeton", async () => {
    const { id } = await publier(E1, null, "Bonjour");
    await banc.en({ id: F }, "select public.commenter($1, 'Merci')", [id]);
    expect(await page(E2, id)).toMatchObject({ statut: "publiee", peut_signaler: true, dernieres_reponses: [{ peut_signaler: true }] });
    expect(await page(E1, id)).toMatchObject({ peut_signaler: false, dernieres_reponses: [{ peut_signaler: true }] });
    expect(await page(A, id)).toMatchObject({ peut_signaler: false, dernieres_reponses: [{ peut_signaler: false }] });
    expect(await page(F, id)).toMatchObject({ peut_signaler: true, dernieres_reponses: [{ peut_signaler: false }] });
    await activer(true);
    await banc.appliquer(MIGRATION);
    expect(await un("select jeton, analyse_active from public.reglages_moderation")).toEqual({ jeton: JETON, analyse_active: true });
    await expect(banc.en({ id: E1 }, "select * from public.reglages_moderation")).rejects.toThrow(REFUS);
  });
});
