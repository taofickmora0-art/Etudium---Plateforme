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
  await banc.db.query("delete from public.journal_moderation");
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

type Element = {
  type: "publication" | "reponse";
  id: string;
  publication_id: string;
  espace: { id: string | null; nom: string };
  auteur: { id: string; prenom: string; nom: string };
  texte: string;
  statut: string;
  analyse: Record<string, string> | null;
  extrait: string | null;
  signalements: { nombre: number; motifs: { motif: string; nombre: number }[]; details: { motif: string; precisions: string; par: string }[] };
};
const signaler = (qui: string, cible: { publication?: string; commentaire?: string }, motif = "spam", precisions = "") =>
  banc.en({ id: qui }, "select public.signaler($1, $2, $3, $4)", [cible.publication ?? null, cible.commentaire ?? null, motif, precisions]);
const repondre = async (qui: string, publication: string, texte = "Merci") =>
  (await banc.en<{ id: string }>({ id: qui }, "select public.commenter($1, $2) as id", [publication, texte]))[0].id;
const file = async (onglet: string) => (await banc.en<{ r: Element[] }>({ id: A }, "select public.file_moderation($1) as r", [onglet]))[0].r;
const notes = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string; categorie: string }>("select titre, texte, lien, categorie from public.notifications where destinataire = $1 order by id", [qui])).rows;
const equipe = (appel: string, params: unknown[]) => banc.en<{ r: string | null }>({ id: A }, `select public.${appel} as r`, params);

describe("Revue finale : modifications, fichier, coût de l'IA", () => {
  const preparer = async (qui: string, p: { publication?: string; parcours?: string | null; texte?: string; piece?: unknown }) =>
    (
      await banc.en<{ r: { objet: string | null } }>({ id: qui }, "select public.preparer_analyse($1, $2, '', $3, $4::jsonb) as r", [
        p.publication ?? null,
        p.parcours ?? null,
        p.texte ?? "Bonjour",
        json(p.piece ?? null),
      ])
    )[0].r;

  it("modifier une publication en attente : elle reste en attente, quel que soit le verdict (seule l'équipe la publie)", async () => {
    await activer(true);
    const { id } = await publier(E1, null, "Sans verdict");
    expect((await ligne(id)).statut).toBe("en_attente");
    expect((await modifier(E1, id, "Texte anodin", verdict("autoriser"))).statut).toBe("en_attente");
    expect(await ligne(id)).toMatchObject({ statut: "en_attente", texte: "Texte anodin" });
    expect(await page(E2, id)).toBeNull();
  });

  it("preparer_analyse : refuse avant l'IA (espace fermé, texte vide, fichier déjà joint, publication d'un autre ou bloquée) ; 10 analyses en 10 minutes au plus, suppressions comprises", async () => {
    await expect(preparer(E2, { parcours: P })).rejects.toThrow("Cet espace ne vous est pas ouvert.");
    await expect(preparer(E1, { texte: " " })).rejects.toThrow("Écrivez votre publication (3 000 caractères au plus).");
    const chemin = `${E1}/${randomUUID()}.png`;
    await deposer(E1, chemin);
    const piece = { chemin, nom: "a.png", type: "image/png", taille: 1000 };
    const { objet } = await preparer(E1, { piece });
    expect(objet).toBe((await un<{ id: string }>("select id from storage.objects where name = $1", [chemin])).id);
    await publier(E1, null, "Avec image", null, piece);
    await expect(preparer(E1, { piece })).rejects.toThrow("Ce fichier n’est pas le vôtre.");
    const autre = await publier(E2, null, "La sienne");
    await expect(preparer(E1, { publication: autre.id })).rejects.toThrow("Cette publication n’est pas la vôtre.");
    expect(await preparer(E2, { publication: autre.id })).toEqual({ objet: null });
    // Publier puis supprimer ne remet pas le compteur à zéro.
    await banc.db.query("delete from public.journal_moderation");
    await banc.db.query("delete from public.publications");
    for (let i = 0; i < 10; i++) await preparer(E2, {});
    await expect(preparer(E2, {})).rejects.toThrow(TROP_VITE);
    expect((await un<{ n: number }>("select count(*)::int as n from public.publications")).n).toBe(0);
  });

  it("un verdict lié à un fichier remplacé pendant l'analyse est refusé ; lié au bon fichier, il s'applique", async () => {
    await activer(true);
    const chemin = `${E1}/${randomUUID()}.png`;
    const piece = { chemin, nom: "a.png", type: "image/png", taille: 1000 };
    await deposer(E1, chemin);
    const { objet } = await preparer(E1, { piece });
    // L'auteur retire le fichier analysé et en dépose un autre au même chemin.
    await banc.en({ id: E1 }, "delete from storage.objects where bucket_id = 'communaute' and name = $1", [chemin]);
    await deposer(E1, chemin);
    const CHANGE = "Ce fichier a changé pendant la vérification. Publiez-le de nouveau.";
    await expect(publier(E1, null, "Image", { ...verdict("autoriser"), objet }, piece)).rejects.toThrow(CHANGE);
    await expect(publier(E1, null, "Image", verdict("autoriser"), piece)).rejects.toThrow(CHANGE);
    const { objet: nouveau } = await preparer(E1, { piece });
    expect((await publier(E1, null, "Image", { ...verdict("autoriser"), objet: nouveau }, piece)).statut).toBe("publiee");
  });
});

describe("Signalements et file de l'équipe", () => {
  it("signaler : motif et précisions ; doublon refusé ; son propre contenu et l'équipe refusés ; Autre sans précisions refusé ; espace fermé refusé", async () => {
    const { id } = await publier(E1, null, "Bonjour");
    await signaler(E2, { publication: id }, "spam", "  Pub  ");
    expect(await un("select motif, precisions, traite_le from public.signalements where publication_id = $1", [id])).toEqual({ motif: "spam", precisions: "Pub", traite_le: null });
    await expect(signaler(E2, { publication: id })).rejects.toThrow("Vous avez déjà signalé ce contenu.");
    await expect(signaler(E1, { publication: id })).rejects.toThrow("Vous ne pouvez pas signaler votre propre contenu.");
    await expect(signaler(A, { publication: id })).rejects.toThrow("L’équipe modère depuis la file.");
    await expect(signaler(F, { publication: id }, "autre", " ")).rejects.toThrow("Précisez le motif du signalement.");
    await expect(signaler(F, { publication: id }, "inconnu")).rejects.toThrow("Choisissez un motif.");
    await expect(signaler(F, { publication: id }, "spam", "x".repeat(501))).rejects.toThrow("500 caractères au plus pour les précisions.");
    const ferme = await publier(E1, P, "Dans Académique");
    await expect(signaler(E2, { publication: ferme.id })).rejects.toThrow("Cet espace ne vous est pas ouvert.");
    const r = await repondre(F, id);
    await signaler(E2, { commentaire: r }, "harcelement");
    await expect(signaler(F, { commentaire: r })).rejects.toThrow("Vous ne pouvez pas signaler votre propre contenu.");
    await expect(signaler(E2, {})).rejects.toThrow("Ce contenu n’existe plus.");
  });

  it("À modérer : au premier signalement seulement", async () => {
    const { id } = await publier(E1, null, "Bonjour");
    await signaler(E2, { publication: id });
    expect(await aModerer()).toBe(2);
    expect((await notes(A))[0]).toMatchObject({ categorie: "service", texte: "Une publication de l’espace général attend votre examen.", lien: "/admin/moderation" });
    await signaler(F, { publication: id }, "harcelement");
    expect(await aModerer()).toBe(2);
    const r = await repondre(F, id);
    await signaler(E2, { commentaire: r });
    expect((await notes(A)).at(-1)?.texte).toBe("Une réponse de l’espace général attend votre examen.");
  });

  it("file : à examiner (en attente, signalée par l'IA, par les membres, réponse), dans l'ordre ; bloquées ; hors équipe refusé ; nombre", async () => {
    await activer(true);
    const attente = await publier(E1, null, "Attente");
    const douteuse = await publier(E1, P, "Douteux", verdict("signaler", "publicite", "Lien externe"));
    const normale = await publier(E2, null, "Normal", verdict("autoriser"));
    await signaler(E1, { publication: normale.id }, "spam", "Pub");
    await signaler(F, { publication: normale.id }, "harcelement", "Insultes");
    const r = await repondre(F, normale.id, "Merci");
    await signaler(E1, { commentaire: r }, "inapproprie");
    const bloquee = await publier(E2, null, "Arnaque", verdict("bloquer", "arnaque"));
    await publier(E2, null, "Rien", verdict("autoriser"));

    const elements = await file("a_examiner");
    expect(elements.map((e) => [e.type, e.id])).toEqual([
      ["publication", attente.id],
      ["publication", douteuse.id],
      ["publication", normale.id],
      ["reponse", r],
    ]);
    expect(elements[0]).toMatchObject({ statut: "en_attente", analyse: null, signalements: { nombre: 0 } });
    expect(elements[1]).toMatchObject({
      espace: { id: P, nom: "Académique" },
      auteur: { id: E1, prenom: "Koffi", nom: "Dossou" },
      analyse: { decision: "signaler", categorie: "publicite", raison: "Lien externe" },
    });
    expect(elements[2].signalements).toMatchObject({
      nombre: 2,
      motifs: [
        { motif: "harcelement", nombre: 1 },
        { motif: "spam", nombre: 1 },
      ],
      details: [
        { motif: "spam", precisions: "Pub", par: "Koffi D." },
        { motif: "harcelement", precisions: "Insultes" },
      ],
    });
    expect(elements[3]).toMatchObject({ type: "reponse", publication_id: normale.id, texte: "Merci", extrait: "Normal", signalements: { nombre: 1 } });
    expect((await file("bloquees")).map((e) => e.id)).toEqual([bloquee.id]);
    expect((await banc.en<{ r: number }>({ id: A }, "select public.nombre_a_examiner() as r"))[0].r).toBe(4);
    await expect(banc.en({ id: E1 }, "select public.file_moderation('a_examiner')")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E1 }, "select public.nombre_a_examiner()")).rejects.toThrow(REFUS);
  });

  it("garder : quitte la file ; en_attente publiée et l'auteur prévenu", async () => {
    await activer(true);
    const attente = await publier(E1, null, "Attente");
    const douteuse = await publier(E1, null, "Douteux", verdict("signaler", "spam"));
    const normale = await publier(E2, null, "Normal", verdict("autoriser"));
    await signaler(E1, { publication: normale.id });
    const r = await repondre(F, normale.id);
    await signaler(E1, { commentaire: r });
    for (const id of [attente.id, douteuse.id, normale.id]) await equipe("garder_contenu($1, null)", [id]);
    await equipe("garder_contenu(null, $1)", [r]);
    expect(await file("a_examiner")).toEqual([]);
    expect(await ligne(attente.id)).toMatchObject({ statut: "publiee", a_examiner: false });
    expect(await ligne(douteuse.id)).toMatchObject({ statut: "publiee", a_examiner: false });
    expect((await un<{ n: number }>("select count(*)::int as n from public.signalements where traite_le is null")).n).toBe(0);
    expect((await notes(E1)).filter((n) => n.titre === "Publication en ligne")).toEqual([
      {
        titre: "Publication en ligne",
        categorie: "service",
        texte: "Votre publication dans l’espace général a été vérifiée par l’équipe Étudium et mise en ligne.",
        lien: `/communaute/publications/${attente.id}`,
      },
    ]);
  });

  it("supprimer : la publication et ses signalements disparaissent, chemin rendu, l'auteur prévenu ; une réponse aussi", async () => {
    const chemin = `${E2}/${randomUUID()}.png`;
    await deposer(E2, chemin);
    const pub = await publier(E2, null, "Pub", null, { chemin, nom: "a.png", type: "image/png", taille: 1000 });
    await signaler(E1, { publication: pub.id });
    expect((await equipe("supprimer_contenu($1, null)", [pub.id]))[0].r).toBe(chemin);
    expect(await ligne(pub.id)).toBeUndefined();
    expect((await un<{ n: number }>("select count(*)::int as n from public.signalements")).n).toBe(0);
    expect((await notes(E2)).at(-1)).toEqual({
      titre: "Publication retirée",
      categorie: "service",
      texte: "Votre publication dans l’espace général a été retirée par l’équipe Étudium : elle ne respecte pas les règles de la communauté.",
      lien: "/communaute",
    });
    const autre = await publier(E1, null, "Question");
    const r = await repondre(F, autre.id, "Insulte");
    await signaler(E1, { commentaire: r });
    expect((await equipe("supprimer_contenu(null, $1)", [r]))[0].r).toBeNull();
    expect((await un<{ n: number }>("select count(*)::int as n from public.commentaires_publications where id = $1", [r])).n).toBe(0);
    expect((await notes(F)).at(-1)).toMatchObject({
      titre: "Réponse retirée",
      texte: "Votre réponse dans l’espace général a été retirée par l’équipe Étudium : elle ne respecte pas les règles de la communauté.",
    });
  });

  it("rétablir : bloquée → publiée, l'auteur prévenu ; contenu disparu : « Ce contenu n’existe plus. » ; hors équipe refusé", async () => {
    await activer(true);
    const bloquee = await publier(E2, null, "Faux positif", verdict("bloquer", "arnaque"));
    await expect(banc.en({ id: E1 }, "select public.retablir_publication($1)", [bloquee.id])).rejects.toThrow(REFUS);
    await equipe("retablir_publication($1)", [bloquee.id]);
    expect(await ligne(bloquee.id)).toMatchObject({ statut: "publiee", a_examiner: false });
    expect((await fil(E1)).map((p) => p.id)).toContain(bloquee.id);
    expect((await notes(E2)).at(-1)).toMatchObject({ titre: "Publication en ligne", lien: `/communaute/publications/${bloquee.id}` });
    const inconnu = randomUUID();
    await expect(equipe("garder_contenu($1, null)", [inconnu])).rejects.toThrow("Ce contenu n’existe plus.");
    await expect(equipe("supprimer_contenu($1, null)", [inconnu])).rejects.toThrow("Ce contenu n’existe plus.");
    await expect(equipe("retablir_publication($1)", [inconnu])).rejects.toThrow("Ce contenu n’existe plus.");
  });
});
