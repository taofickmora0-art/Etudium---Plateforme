import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, MIGRATIONS_LOT_0, type Banc } from "./banc";

// Migration 0035 : la messagerie (lot 5, étape A ; spec de la fin du lot 5, Q1 à Q6). L'étudiant écrit au formateur
// d'une formation qu'il suit et à l'Équipe Étudium ; le formateur écrit à ses étudiants ; l'équipe répond à l'assistance.

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin (équipe)
const F = randomUUID(); // formateur de la formation suivie par E
const G = randomUUID(); // autre formateur
const E = randomUUID(); // étudiante qui suit la formation de F
const X = randomUUID(); // étudiant qui suit seulement la formation de G
let CE: string; // conversation E ↔ F
let CA: string; // assistance de E

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
type Resume = { id: string; avec: { nom: string; role: string; equipe: boolean }; formation: { titre: string; slug: string } | null; dernier: { texte: string; fichier: string | null; de_moi: boolean } | null; non_lu: boolean };
type MessageBase = { id: string; texte: string; fichier: { nom: string; format: string; taille: number } | null; de_moi: boolean; auteur: string | null };

const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const ouvrir = async (qui: string, avec: string | null) => (await banc.en<{ id: string }>({ id: qui }, "select public.ouvrir_conversation($1) as id", [avec]))[0].id;
const envoyer = async (qui: string, conv: string, texte: string, fichier: string | null = null, nom: string | null = null) =>
  (await banc.en<{ m: MessageBase }>({ id: qui }, "select public.envoyer_message($1, $2, $3, $4) as m", [conv, texte, fichier, nom]))[0].m;
const fil = async (qui: string, conv: string) =>
  (await banc.en<{ f: { conversation: Resume; messages: MessageBase[]; plus_anciens: boolean } | null }>({ id: qui }, "select public.fil_conversation($1) as f", [conv]))[0].f;
const liste = async (qui: string, espace: string) => (await banc.en<{ l: Resume[] }>({ id: qui }, "select public.mes_conversations($1) as l", [espace]))[0].l;
const nonLus = async (qui: string, espace: string) => (await banc.en<{ n: number }>({ id: qui }, "select public.messages_non_lus($1) as n", [espace]))[0].n;
const notifs = async (qui: string) =>
  (await banc.db.query<{ titre: string; texte: string; lien: string; lue: boolean }>(
    "select titre, texte, lien, lue_le is not null as lue from public.notifications where destinataire = $1 and categorie = 'messages' order by cree_le, id",
    [qui],
  )).rows;
const deposer = (qui: string, chemin: string, type = XLSX, taille = 248_000) =>
  banc.en({ id: qui }, "insert into storage.objects (bucket_id, name, owner, metadata) values ('messages', $1, $2, $3::jsonb)", [chemin, qui, JSON.stringify({ mimetype: type, size: taille })]);

beforeAll(async () => {
  banc = await creerBanc([
    ...MIGRATIONS_LOT_0,
    ...[
      "0004_contenus", "0005_back_office", "0006_notes", "0007_visionnage", "0008_progression", "0009_favoris", "0010_avis", "0011_statistiques",
      "0012_couvertures", "0013_utilisateurs", "0014_espace_formateur", "0015_suivi_etudiants", "0016_notifications", "0017_role_unique",
      "0018_sessions_live", "0019_communaute", "0020_moderation", "0021_communaute_actualites", "0022_communaute_video", "0023_sessions_rappels",
      "0024_sessions_promotion", "0025_communaute_commentaires", "0026_communaute_sondages", "0027_lecons_statut", "0028_discussions_lecons",
      "0029_apprenants_formation", "0030_plateformes_video", "0031_quiz", "0032_exercices", "0033_certificats", "0034_finitions_lot_3",
      "0035_messagerie",
    ].map((m) => `supabase/migrations/${m}.sql`),
  ]);
  for (const [id, roles] of [[S, ["super_admin"]], [A, ["admin"]], [F, []], [G, []], [E, []], [X, []]] as const) await banc.creerCompte(id, [...roles]);
  await banc.db.query("update public.profils set prenom = 'Aïcha', nom = 'Kpadé' where id = $1", [E]);
  await banc.db.query("update public.profils set prenom = 'Kossi', nom = 'Agbo' where id = $1", [X]);
  await banc.db.query("update public.profils set prenom = 'Awa', nom = 'Diallo' where id = $1", [A]);
  for (const f of [F, G]) await banc.en({ id: S }, "select public.changer_role($1, 'formateur')", [f]);
  const ficheF = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [F])).id;
  const ficheG = (await un<{ id: string }>("select id from public.formateurs where compte_id = $1", [G])).id;
  await banc.db.query("update public.formateurs set nom = 'Dr Mireille Adjovi' where id = $1", [ficheF]);
  const formation = async (titre: string, fiche: string) => {
    const f = (await un<{ id: string }>("insert into public.formations (titre, slug, formateur_id, gratuite, statut) values ($1, $2, $3, true, 'publiee') returning id", [titre, `${titre.toLowerCase()}-${randomUUID().slice(0, 6)}`, fiche])).id;
    const m = (await un<{ id: string }>("insert into public.modules (formation_id, titre) values ($1, 'Module 1') returning id", [f])).id;
    return (await un<{ id: string }>("insert into public.lecons (module_id, titre, publiee, ordre) values ($1, 'Leçon 1', true, 1) returning id", [m])).id;
  };
  const excel = await formation("Excel", ficheF);
  const word = await formation("Word", ficheG);
  await banc.en({ id: E }, "select public.terminer_lecon($1)", [excel]);
  await banc.en({ id: X }, "select public.terminer_lecon($1)", [word]);
});

describe("Étudiant et formateur", () => {
  it("l'étudiante écrit au formateur d'une formation qu'elle suit ; une seule conversation ; il lui répond", async () => {
    CE = await ouvrir(E, F);
    expect(await ouvrir(E, F)).toBe(CE);
    expect(await ouvrir(F, E)).toBe(CE);
    const m = await envoyer(E, CE, "  Bonjour Docteur  ");
    expect(m).toMatchObject({ texte: "Bonjour Docteur", de_moi: true, fichier: null, auteur: null });

    const [vueF] = await liste(F, "formateur");
    expect(vueF).toMatchObject({ id: CE, avec: { nom: "Aïcha Kpadé", role: "Étudiant·e", equipe: false }, non_lu: true, dernier: { texte: "Bonjour Docteur", de_moi: false } });
    expect(vueF.formation?.titre).toBe("Excel");
    expect(await nonLus(F, "formateur")).toBe(1);
    const f = await fil(F, CE);
    expect(f?.messages.map((x) => [x.texte, x.de_moi])).toEqual([["Bonjour Docteur", false]]);
    expect(await nonLus(F, "formateur")).toBe(0);

    await envoyer(F, CE, "Bonjour Aïcha");
    const [vueE] = await liste(E, "etudiant");
    expect(vueE).toMatchObject({ avec: { nom: "Dr Mireille Adjovi", role: "Formateur·rice", equipe: false }, non_lu: true, dernier: { texte: "Bonjour Aïcha", de_moi: false } });
    expect(await nonLus(E, "etudiant")).toBe(1);
  });

  it("personne d'autre n'ouvre, ne lit ni n'écrit", async () => {
    await expect(ouvrir(X, F)).rejects.toThrow("Vous ne pouvez pas écrire à cette personne.");
    await expect(ouvrir(G, E)).rejects.toThrow("Vous ne pouvez pas écrire à cette personne.");
    await expect(ouvrir(E, E)).rejects.toThrow("Vous ne pouvez pas écrire à cette personne.");
    expect(await fil(X, CE)).toBeNull();
    expect(await fil(G, CE)).toBeNull();
    expect(await fil(A, CE)).toBeNull();
    await expect(envoyer(X, CE, "Coucou")).rejects.toThrow();
    expect(await liste(X, "etudiant")).toEqual([]);
    expect(await liste(G, "formateur")).toEqual([]);
  });
});

describe("L'assistance", () => {
  it("l'étudiante écrit à l'équipe ; toute l'équipe la voit et répond au nom d'« Équipe Étudium »", async () => {
    CA = await ouvrir(E, null);
    expect(await ouvrir(E, null)).toBe(CA);
    await envoyer(E, CA, "Sujet : Certificat\nMon certificat ne s’affiche pas.");
    const [vueA] = await liste(A, "equipe");
    expect(vueA).toMatchObject({ id: CA, avec: { nom: "Aïcha Kpadé", role: "Assistance" }, non_lu: true });
    expect(await nonLus(S, "equipe")).toBe(1);
    expect((await notifs(A)).at(-1)).toMatchObject({ titre: "Nouvelle demande d’assistance de Aïcha Kpadé", lien: `/admin/messages?c=${CA}` });
    expect((await notifs(S)).at(-1)).toMatchObject({ lien: `/admin/messages?c=${CA}` });

    await envoyer(A, CA, "Bonjour Aïcha, nous regardons.");
    // Une réponse de l'équipe : la conversation est lue pour toute l'équipe.
    expect(await nonLus(S, "equipe")).toBe(0);
    expect((await notifs(S)).at(-1)).toMatchObject({ lue: true });
    const vueE = (await liste(E, "etudiant")).find((c) => c.id === CA);
    expect(vueE).toMatchObject({ avec: { nom: "Équipe Étudium", role: "Assistance", equipe: true }, formation: null, non_lu: true });
    expect((await notifs(E)).at(-1)).toMatchObject({ titre: "Nouveau message de Équipe Étudium", lien: `/messages?c=${CA}` });
    // Vu par un autre membre de l'équipe : le nom de celui qui a répondu.
    expect((await fil(S, CA))?.messages.at(-1)).toMatchObject({ de_moi: true, auteur: "Awa Diallo" });
    expect((await fil(A, CA))?.messages.at(-1)).toMatchObject({ de_moi: true, auteur: null });

    expect(await fil(X, CA)).toBeNull();
    expect(await fil(F, CA)).toBeNull();
    expect((await liste(F, "formateur")).some((c) => c.id === CA)).toBe(false);
  });
});

describe("Notifications et non-lus", () => {
  it("une seule notification non lue par conversation ; l'ouvrir la marque lue ; la préférence « messages » est respectée", async () => {
    await fil(F, CE);
    const avant = (await notifs(F)).length;
    await envoyer(E, CE, "Premier");
    await envoyer(E, CE, "Second");
    const apres = await notifs(F);
    expect(apres.length).toBe(avant + 1);
    expect(apres.filter((n) => !n.lue)).toEqual([{ titre: "Nouveau message de Aïcha Kpadé", texte: "Second", lien: `/formateur/messages?c=${CE}`, lue: false }]);
    await fil(F, CE);
    expect((await notifs(F)).filter((n) => !n.lue)).toEqual([]);

    await banc.db.query("update public.profils set preferences_notifications = preferences_notifications || '{\"messages\": false}'::jsonb where id = $1", [E]);
    const nE = (await notifs(E)).length;
    await envoyer(F, CE, "Sans notification");
    expect((await notifs(E)).length).toBe(nE);
    await banc.db.query("update public.profils set preferences_notifications = preferences_notifications - 'messages' where id = $1", [E]);
  });
});

describe("Refus", () => {
  it("vide, trop long, trop de messages, compte suspendu", async () => {
    await expect(envoyer(E, CE, "   ")).rejects.toThrow("Écrivez un message ou joignez un fichier.");
    await expect(envoyer(E, CE, "x".repeat(4001))).rejects.toThrow("Votre message dépasse 4 000 caractères.");
    await banc.db.query(
      "insert into public.messages (conversation_id, auteur_id, de_etudiant, texte) select $1, $2, true, 'rafale ' || g from generate_series(1, 30) g",
      [CE, E],
    );
    await expect(envoyer(E, CE, "Encore")).rejects.toThrow("Trop de messages en peu de temps : réessayez dans quelques minutes.");
    await banc.db.query("delete from public.messages where texte like 'rafale %'");
    await banc.db.query("insert into public.suspensions (profil_id) values ($1)", [E]);
    await expect(envoyer(E, CE, "Suspendue")).rejects.toThrow("Votre compte est suspendu.");
    await banc.db.query("delete from public.suspensions where profil_id = $1", [E]);
  });
});

describe("Pièces jointes", () => {
  it("un fichier de son dossier, lisible par les deux participants seulement", async () => {
    const chemin = `${E}/${randomUUID()}/tableau.xlsx`;
    await deposer(E, chemin);
    const m = await envoyer(E, CE, "", chemin, "Tableau_ventes.xlsx");
    expect(m.fichier).toEqual({ nom: "Tableau_ventes.xlsx", format: XLSX, taille: 248000 });
    const lit = async (qui: string) => (await banc.en({ id: qui }, "select name from storage.objects where bucket_id = 'messages' and name = $1", [chemin])).length;
    expect(await lit(F)).toBe(1);
    expect(await lit(X)).toBe(0);
    expect(await lit(A)).toBe(0);
    const lien = async (qui: string) => (await banc.en<{ f: { chemin: string; nom: string } | null }>({ id: qui }, "select public.fichier_message($1) as f", [m.id]))[0].f;
    expect(await lien(F)).toEqual({ chemin, nom: "Tableau_ventes.xlsx" });
    expect(await lien(X)).toBeNull();
  });

  it("refus : dossier d'un autre, déjà attaché, format, taille", async () => {
    const autre = `${F}/${randomUUID()}/note.pdf`;
    await deposer(F, autre, "application/pdf");
    await expect(envoyer(E, CE, "", autre, "note.pdf")).rejects.toThrow("Ce fichier n’a pas été reçu. Déposez-le à nouveau.");
    const joint = `${E}/${randomUUID()}/a.pdf`;
    await deposer(E, joint, "application/pdf");
    await envoyer(E, CE, "Voici", joint, "a.pdf");
    await expect(envoyer(E, CA, "Encore", joint, "a.pdf")).rejects.toThrow("Ce fichier n’a pas été reçu. Déposez-le à nouveau.");
    const texte = `${E}/${randomUUID()}/notes.txt`;
    await deposer(E, texte, "text/plain");
    await expect(envoyer(E, CE, "", texte, "notes.txt")).rejects.toThrow("Ce format n’est pas accepté.");
    const lourd = `${E}/${randomUUID()}/gros.pdf`;
    await deposer(E, lourd, "application/pdf", 10_485_761);
    await expect(envoyer(E, CE, "", lourd, "gros.pdf")).rejects.toThrow("Le fichier dépasse 10 Mo.");
  });
});

describe("Contacts", () => {
  it("l'étudiante : les formateurs de ses formations ; le formateur : ses étudiants, filtrés par nom", async () => {
    const contacts = async (qui: string, espace: string, recherche = "") =>
      (await banc.en<{ c: { id: string; nom: string; formation: string }[] }>({ id: qui }, "select public.contacts_messagerie($1, $2) as c", [espace, recherche]))[0].c;
    expect(await contacts(E, "etudiant")).toEqual([expect.objectContaining({ id: F, nom: "Dr Mireille Adjovi", formation: "Excel" })]);
    expect(await contacts(X, "etudiant")).toEqual([expect.objectContaining({ id: G, formation: "Word" })]);
    expect((await contacts(F, "formateur")).map((c) => c.nom)).toEqual(["Aïcha Kpadé"]);
    expect(await contacts(F, "formateur", "aïch")).toHaveLength(1);
    expect(await contacts(F, "formateur", "zzz")).toEqual([]);
    expect(await contacts(G, "formateur")).toEqual([expect.objectContaining({ id: X, nom: "Kossi Agbo" })]);
  });
});

describe("Suppression du compte", () => {
  it("les conversations de l'étudiante partent ; ses fichiers sont rendus pour être effacés", async () => {
    const chemins = (await banc.en<{ c: string[] }>({ id: E }, "select public.oublier_mes_messages() as c"))[0].c;
    expect(chemins.length).toBeGreaterThanOrEqual(2);
    expect(chemins.every((c) => c.startsWith(`${E}/`))).toBe(true);
    expect(await liste(F, "formateur")).toEqual([]);
    expect((await liste(A, "equipe")).some((c) => c.id === CA)).toBe(false);
  });
});
