import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0019 : la communauté (spec 2026-10-14-communaute). Règle provisoire avant le lot 2 : l'espace général est
// ouvert à tout compte ; un espace de parcours à qui suit une formation du parcours, à son formateur et à l'équipe.
const MIGRATION = "supabase/migrations/0019_communaute.sql";
const REFUS = /row-level security|permission denied/;
const FERME = "Cet espace ne vous est pas ouvert.";

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
const F = randomUUID(); // formateur de X (parcours P)
const E1 = randomUUID(); // suit X
const E2 = randomUUID(); // ne suit rien
let FA: string;
let P: string;
let Q: string;
let X: string;

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
type Carte = { id: string; titre: string; texte: string; est_moi: boolean; modifiee: boolean; peut_supprimer: boolean; auteur: { prenom: string; nom: string; role: string | null }; espace: { id: string | null; nom: string }; piece_jointe: unknown };
const publier = async (qui: string, espace: string | null, texte = "Bonjour", titre = "", piece: unknown = null) =>
  (await banc.en<{ id: string }>({ id: qui }, "select public.publier($1, $2, $3, $4::jsonb) as id", [espace, titre, texte, piece === null ? null : JSON.stringify(piece)]))[0].id;
const fil = async (qui: string, espace: string, avant: string | null = null, avantId: string | null = null, nombre = 20) =>
  (await banc.en<{ r: { publications: Carte[]; suite: boolean } }>({ id: qui }, "select public.fil_communaute($1, $2::timestamptz, $3::uuid, $4) as r", [espace, avant, avantId, nombre]))[0].r;
const deposer = (qui: string, chemin: string) => banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner) values ('communaute', $1, $2)", [chemin, qui]);

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
    MIGRATION,
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [E1, []], [E2, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Mireille', nom = 'Akpo' where id = $1", [F]);
  await banc.db.query("update public.profils set prenom = 'Koffi', nom = 'Dossou' where id = $1", [E1]);
  await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [F]);
  FA = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  P = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, 'Réussite académique', 'Académique', 'academique', -2) returning id", [`p-${randomUUID()}`])).id;
  Q = (await un<{ id: string }>("insert into public.parcours (slug, nom, nom_court, couleur, ordre) values ($1, 'Business', 'Business', 'business', -1) returning id", [`q-${randomUUID()}`])).id;
  X = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, statut) values ('Excel', $1, $2, 'publiee') returning id", [`x-${randomUUID()}`, FA])).id;
  await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id) values ($1, $2)", [X, P]);
  const m = await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'M') returning id", [X]);
  const l = await un<{ id: string }>("insert into public.lecons (module_id, titre) values ($1, 'L') returning id", [m.id]);
  await banc.db.query("insert into public.progression_lecons (profil_id, lecon_id) values ($1, $2)", [E1, l.id]);
});

describe("Espaces et publications", () => {
  it("espaces_communaute : Général d'abord, puis les parcours ; ouvert selon le compte", async () => {
    type E = { id: string | null; nom: string; nom_court: string; ouvert: boolean };
    const espaces = async (qui: string) => (await banc.en<{ r: E[] }>({ id: qui }, "select public.espaces_communaute() as r"))[0].r;
    const ouvert = (liste: E[], id: string | null) => liste.find((e) => e.id === id)?.ouvert;
    const deE1 = await espaces(E1);
    expect(deE1[0]).toMatchObject({ id: null, nom: "Général", ouvert: true });
    expect([ouvert(deE1, P), ouvert(deE1, Q)]).toEqual([true, false]);
    expect(deE1.findIndex((e) => e.id === P)).toBeLessThan(deE1.findIndex((e) => e.id === Q));
    expect([ouvert(await espaces(E2), P), ouvert(await espaces(F), P), ouvert(await espaces(F), Q), ouvert(await espaces(A), Q)]).toEqual([false, true, false, true]);
  });

  it("publier : général pour tous ; parcours pour le suiveur, le formateur et l'équipe ; refus pour E2", async () => {
    for (const qui of [E1, E2, F, A]) expect(await publier(qui, null)).toBeTruthy();
    for (const qui of [E1, F, A]) expect(await publier(qui, P)).toBeTruthy();
    await expect(publier(E2, P)).rejects.toThrow(FERME);
    await expect(publier(E1, Q)).rejects.toThrow(FERME);
  });

  it("publier : textes nettoyés et bornés ; titre facultatif", async () => {
    const id = await publier(E1, null, "  Le texte  ", "  Un titre  ");
    expect(await un("select titre, texte from public.publications where id = $1", [id])).toEqual({ titre: "Un titre", texte: "Le texte" });
    await expect(publier(E1, null, "   ")).rejects.toThrow("Écrivez votre publication (3 000 caractères au plus).");
    await expect(publier(E1, null, "x".repeat(3001))).rejects.toThrow("Écrivez votre publication (3 000 caractères au plus).");
    await expect(publier(E1, null, "ok", "t".repeat(121))).rejects.toThrow("Le titre dépasse 120 caractères.");
  });

  it("fil « tous » : mêle les espaces ouverts, jamais un espace fermé ; fil d'un espace fermé : vide", async () => {
    const dansP = await publier(F, P, "Dans Académique");
    const general = await publier(E2, null, "Dans le général");
    const pourE1 = (await fil(E1, "tous")).publications.map((p) => p.id);
    expect(pourE1).toEqual(expect.arrayContaining([dansP, general]));
    const pourE2 = (await fil(E2, "tous")).publications;
    expect(pourE2.map((p) => p.id)).toContain(general);
    expect(pourE2.map((p) => p.id)).not.toContain(dansP);
    expect(pourE2.every((p) => p.espace.id === null)).toBe(true);
    expect((await fil(E2, P)).publications).toEqual([]);
    expect((await fil(E1, P)).publications.every((p) => p.espace.id === P)).toBe(true);
    expect((await fil(E1, P)).publications.find((p) => p.id === dansP)?.espace).toEqual({ id: P, nom: "Académique" });
    expect((await fil(E1, "tous")).publications.find((p) => p.id === general)?.espace).toEqual({ id: null, nom: "général" });
  });

  it("Voir plus : 25 publications de la même seconde, lues par 20 puis à partir de la dernière : 25 distinctes", async () => {
    await banc.db.query("delete from public.publications");
    await banc.db.query("insert into public.publications (auteur, parcours_id, texte, cree_le) select $1, null, 'N' || g, now() from generate_series(1, 25) g", [E2]);
    const premiere = await fil(E1, "tous");
    expect([premiere.publications.length, premiere.suite]).toEqual([20, true]);
    const derniere = premiere.publications[19] as Carte & { cree_le: string };
    const seconde = await fil(E1, "tous", derniere.cree_le, derniere.id);
    expect([seconde.publications.length, seconde.suite]).toEqual([5, false]);
    expect(new Set([...premiere.publications, ...seconde.publications].map((p) => p.id)).size).toBe(25);
  });

  it("modifier : l'auteur seulement, « modifiee » ; supprimer : l'auteur ou l'équipe, chemin du fichier rendu", async () => {
    const id = await publier(E1, null, "Avant");
    await banc.en({ id: E1 }, "select public.modifier_publication($1, 'Titre', 'Après')", [id]);
    expect(await un("select titre, texte, modifiee from public.publications where id = $1", [id])).toEqual({ titre: "Titre", texte: "Après", modifiee: true });
    await expect(banc.en({ id: E2 }, "select public.modifier_publication($1, '', 'Pirate')", [id])).rejects.toThrow("Cette publication n’est pas la vôtre.");
    await expect(banc.en({ id: A }, "select public.modifier_publication($1, '', 'Équipe')", [id])).rejects.toThrow("Cette publication n’est pas la vôtre.");
    await expect(banc.en({ id: E2 }, "select public.supprimer_publication($1)", [id])).rejects.toThrow("Cette publication n’est pas la vôtre.");
    expect(await banc.en({ id: E1 }, "select public.supprimer_publication($1) as chemin", [id])).toEqual([{ chemin: null }]);
    const autre = await publier(E2, null, "Par E2");
    expect(await banc.en({ id: A }, "select public.supprimer_publication($1) as chemin", [autre])).toEqual([{ chemin: null }]);
    expect(await un("select count(*)::int as n from public.publications where id in ($1, $2)", [id, autre])).toEqual({ n: 0 });
    await expect(banc.en({ id: E1 }, "select public.supprimer_publication($1)", [id])).rejects.toThrow("Cette publication n’existe plus.");
  });

  it("pièce jointe : refusée hors de son dossier, avec « .. », inexistante ou d'un autre type ; acceptée sinon ; chemin rendu à la suppression", async () => {
    const mien = `${E1}/${randomUUID()}.png`;
    const autre = `${E2}/${randomUUID()}.png`;
    await deposer(E1, mien);
    await deposer(E2, autre);
    const piece = (chemin: string, type = "image/png", taille = 1000) => ({ chemin, nom: "affiche.png", type, taille });
    const REFUSE = "Ce fichier n’est pas le vôtre.";
    await expect(publier(E1, null, "x", "", piece(autre))).rejects.toThrow(REFUSE);
    await expect(publier(E1, null, "x", "", piece(`${E2}/../${E1}/x.png`))).rejects.toThrow(REFUSE);
    await expect(publier(E1, null, "x", "", piece(`${E1}/absent.png`))).rejects.toThrow(REFUSE);
    await expect(publier(E1, null, "x", "", piece(mien, "application/zip"))).rejects.toThrow(REFUSE);
    await expect(publier(E1, null, "x", "", piece(mien, "image/png", 10_485_761))).rejects.toThrow(REFUSE);
    const id = await publier(E1, null, "Mon affiche", "", piece(mien));
    expect((await fil(E1, "tous")).publications.find((p) => p.id === id)?.piece_jointe).toEqual(piece(mien));
    expect(await banc.en({ id: E1 }, "select public.supprimer_publication($1) as chemin", [id])).toEqual([{ chemin: mien }]);
  });

  it("stockage : le fichier se lit par un compte de l'espace, pas par un autre ; on ne dépose que dans son dossier", async () => {
    const chemin = `${F}/${randomUUID()}.pdf`;
    await deposer(F, chemin);
    await publier(F, P, "Le plan", "", { chemin, nom: "plan.pdf", type: "application/pdf", taille: 245760 });
    const lit = async (qui: string) => (await banc.en<{ name: string }>({ id: qui }, "select name from storage.objects where bucket_id = 'communaute' and name = $1", [chemin])).length;
    expect([await lit(F), await lit(E1), await lit(A), await lit(E2)]).toEqual([1, 1, 1, 0]);
    await expect(deposer(E1, `${E2}/${randomUUID()}.png`)).rejects.toThrow(REFUS);
  });

  it("l'équipe supprime la publication d'un autre : son fichier se retire aussi du stockage", async () => {
    const chemin = `${E1}/${randomUUID()}.png`;
    await deposer(E1, chemin);
    const id = await publier(E1, null, "À retirer", "", { chemin, nom: "a.png", type: "image/png", taille: 1000 });
    const [{ rendu }] = await banc.en<{ rendu: string }>({ id: A }, "select public.supprimer_publication($1) as rendu", [id]);
    const retires = await banc.en<{ name: string }>({ id: A }, "delete from storage.objects where bucket_id = 'communaute' and name = $1 returning name", [rendu]);
    expect(retires).toEqual([{ name: chemin }]);
  });

  it("un fichier publié ne se retire ni ne se remplace par son auteur, et ne s'attache qu'une fois ; libéré à la suppression", async () => {
    const chemin = `${E1}/${randomUUID()}.png`;
    const piece = { chemin, nom: "a.png", type: "image/png", taille: 1000 };
    const retirer = (qui: string) => banc.en<{ name: string }>({ id: qui }, "delete from storage.objects where bucket_id = 'communaute' and name = $1 returning name", [chemin]);
    await deposer(E1, chemin);
    const id = await publier(E1, null, "Mon affiche", "", piece);
    expect(await retirer(E1)).toEqual([]);
    await expect(deposer(E1, chemin)).rejects.toThrow();
    await expect(publier(E1, null, "La même affiche", "", piece)).rejects.toThrow("Ce fichier n’est pas le vôtre.");
    await banc.en({ id: E1 }, "select public.supprimer_publication($1)", [id]);
    expect(await retirer(E1)).toEqual([{ name: chemin }]);
  });

  it("carte : rôle formateur ou équipe, est_moi, peut_supprimer ; aucune adresse e-mail", async () => {
    const deF = await publier(F, null, "Du formateur");
    const deA = await publier(A, null, "De l'équipe");
    const deE1 = await publier(E1, null, "De Koffi");
    const cartes = (await fil(E1, "tous")).publications;
    const carte = (id: string) => cartes.find((p) => p.id === id)!;
    expect(carte(deF).auteur).toEqual({ prenom: "Mireille", nom: "Akpo", role: "formateur" });
    expect(carte(deA).auteur.role).toBe("equipe");
    expect(carte(deE1)).toMatchObject({ est_moi: true, peut_supprimer: true, auteur: { prenom: "Koffi", nom: "Dossou", role: null } });
    expect(carte(deF)).toMatchObject({ est_moi: false, peut_supprimer: false });
    expect((await fil(A, "tous")).publications.find((p) => p.id === deE1)?.peut_supprimer).toBe(true);
    expect(JSON.stringify(cartes)).not.toContain("@");
    expect(await banc.en({ id: E1 }, "select public.publication_communaute($1) as r", [randomUUID()])).toEqual([{ r: null }]);
  });

  it("répondre : réponses et 2 dernières dans l'ordre ; « Nouvelle réponse » à l'auteur, pas à soi", async () => {
    await banc.db.query("delete from public.notifications");
    const id = await publier(E1, null, "Une question");
    for (const texte of ["Première", "Deuxième", "Troisième"]) await banc.en({ id: F }, "select public.commenter($1, $2)", [id, texte]);
    await banc.en({ id: E1 }, "select public.commenter($1, 'Merci !')", [id]);
    type Rep = { texte: string; est_moi: boolean; auteur: { prenom: string; nom_court: string }; peut_supprimer: boolean };
    const carte = (await fil(E1, "tous")).publications.find((p) => p.id === id) as Carte & { reponses: number; dernieres_reponses: Rep[] };
    expect(carte.reponses).toBe(4);
    expect(carte.dernieres_reponses.map((r) => r.texte)).toEqual(["Troisième", "Merci !"]);
    expect(carte.dernieres_reponses[0]).toMatchObject({ est_moi: false, auteur: { prenom: "Mireille", nom_court: "Mireille A." }, peut_supprimer: false });
    expect(carte.dernieres_reponses[1]).toMatchObject({ est_moi: true, peut_supprimer: true });
    const notes = (await banc.db.query<{ categorie: string; titre: string; texte: string; lien: string }>("select categorie, titre, texte, lien from public.notifications where destinataire = $1", [E1])).rows;
    expect(notes).toHaveLength(3);
    expect(notes[0]).toEqual({ categorie: "communaute", titre: "Nouvelle réponse", texte: "Mireille A. a répondu à votre publication dans l’espace général.", lien: `/communaute/publications/${id}` });
    const dansP = await publier(E1, P, "Dans Académique");
    await banc.en({ id: F }, "select public.commenter($1, 'Oui')", [dansP]);
    expect((await banc.db.query<{ texte: string }>("select texte from public.notifications where destinataire = $1 order by id desc limit 1", [E1])).rows[0].texte).toBe(
      "Mireille A. a répondu à votre publication dans l’espace Académique.",
    );
    const [{ r }] = await banc.en<{ r: { toutes_reponses: Rep[] } }>({ id: E1 }, "select public.publication_communaute($1) as r", [id]);
    expect(r.toutes_reponses.map((x) => x.texte)).toEqual(["Première", "Deuxième", "Troisième", "Merci !"]);
  });

  it("répondre ou aimer dans un espace fermé : refus ; publication inconnue ; réponse vide", async () => {
    const dansP = await publier(F, P, "Réservé");
    await expect(banc.en({ id: E2 }, "select public.commenter($1, 'Intrus')", [dansP])).rejects.toThrow(FERME);
    await expect(banc.en({ id: E2 }, "select public.basculer_reaction($1)", [dansP])).rejects.toThrow(FERME);
    await expect(banc.en({ id: E1 }, "select public.commenter($1, 'x')", [randomUUID()])).rejects.toThrow("Cette publication n’existe plus.");
    await expect(banc.en({ id: E1 }, "select public.commenter($1, '   ')", [dansP])).rejects.toThrow("Écrivez votre réponse (1 000 caractères au plus).");
    await expect(banc.en({ id: E1 }, "select public.commenter($1, $2)", [dansP, "x".repeat(1001)])).rejects.toThrow("Écrivez votre réponse (1 000 caractères au plus).");
  });

  it("supprimer une réponse : l'auteur ou l'équipe ; un autre : refus", async () => {
    const id = await publier(E1, null, "Pour les réponses");
    const [{ c: deE2 }] = await banc.en<{ c: string }>({ id: E2 }, "select public.commenter($1, 'De E2') as c", [id]);
    const [{ c: deF }] = await banc.en<{ c: string }>({ id: F }, "select public.commenter($1, 'De F') as c", [id]);
    await expect(banc.en({ id: E1 }, "select public.supprimer_commentaire($1)", [deE2])).rejects.toThrow("Cette réponse n’est pas la vôtre.");
    await banc.en({ id: E2 }, "select public.supprimer_commentaire($1)", [deE2]);
    await banc.en({ id: A }, "select public.supprimer_commentaire($1)", [deF]);
    expect(await un("select count(*)::int as n from public.commentaires_publications where publication_id = $1", [id])).toEqual({ n: 0 });
  });

  it("J’aime bascule : 1 puis 0 ; j_aime suit le compte", async () => {
    const id = await publier(F, P, "À aimer");
    const aimer = async (qui: string) => (await banc.en<{ r: { j_aime: boolean; reactions: number } }>({ id: qui }, "select public.basculer_reaction($1) as r", [id]))[0].r;
    expect(await aimer(E1)).toEqual({ j_aime: true, reactions: 1 });
    expect(await aimer(A)).toEqual({ j_aime: true, reactions: 2 });
    expect(await aimer(E1)).toEqual({ j_aime: false, reactions: 1 });
    const carte = (await fil(A, "tous")).publications.find((p) => p.id === id) as Carte & { reactions: number; j_aime: boolean };
    expect([carte.reactions, carte.j_aime]).toEqual([1, true]);
  });

  it("supprimer une publication emporte ses réponses et ses réactions", async () => {
    const id = await publier(E1, null, "Éphémère");
    await banc.en({ id: F }, "select public.commenter($1, 'Réponse')", [id]);
    await banc.en({ id: F }, "select public.basculer_reaction($1)", [id]);
    await banc.en({ id: E1 }, "select public.supprimer_publication($1)", [id]);
    expect(await un("select (select count(*)::int from public.commentaires_publications where publication_id = $1) as c, (select count(*)::int from public.reactions_publications where publication_id = $1) as r", [id])).toEqual({ c: 0, r: 0 });
  });

  it("membres actifs : 3 au plus, les plus actifs, avec leur espace ; jamais un espace fermé au demandeur", async () => {
    await banc.db.query("delete from public.publications");
    for (let i = 0; i < 4; i++) await publier(E1, P, `Académique ${i}`);
    for (let i = 0; i < 3; i++) await publier(F, null, `Général ${i}`);
    const id = await publier(A, null, "Une");
    await banc.en({ id: E2 }, "select public.commenter($1, 'Un')", [id]);
    type M = { prenom: string; nom_court: string; initiales: string; espace: string };
    const membres = async (qui: string) => (await banc.en<{ r: M[] }>({ id: qui }, "select public.membres_actifs() as r"))[0].r;
    const pourE1 = await membres(E1);
    expect(pourE1).toHaveLength(3);
    expect(pourE1[0]).toEqual({ prenom: "Koffi", nom_court: "Koffi D.", initiales: "KD", espace: "Académique" });
    expect(pourE1[1]).toMatchObject({ nom_court: "Mireille A.", espace: "Général" });
    const pourE2 = await membres(E2);
    expect(pourE2.map((m) => m.prenom)).not.toContain("Koffi");
    expect(pourE2[0]).toMatchObject({ nom_court: "Mireille A." });
  });

  it("compte suspendu et visiteur : refusés ; tables fermées ; la migration est rejouable", async () => {
    const E3 = randomUUID();
    await banc.creerCompte(E3);
    await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [E3]);
    await expect(publier(E3, null)).rejects.toThrow("Accès réservé aux comptes connectés.");
    await expect(banc.en("anon", "select public.fil_communaute('tous')")).rejects.toThrow(REFUS);
    await expect(banc.en({ id: E1 }, "select * from public.publications")).rejects.toThrow(REFUS);
    await banc.appliquer(MIGRATION);
    await banc.appliquer(MIGRATION);
  });
});
