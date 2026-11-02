import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { creerBanc, migrationsJusqua, type Banc, type Qui } from "./banc";

// Migration 0061 : le journal des actions de l'équipe (lot 6 A, spec §2). Écrit par la base, dans la même opération
// que l'action ; seulement quand l'auteur est un membre de l'équipe. Personne n'y écrit, ne le modifie ni ne l'efface ;
// le super admin seul le lit.

let banc: Banc;
const S = randomUUID(); // super admin
const A = randomUUID(); // admin
const M = randomUUID(); // modérateur
const E = randomUUID(); // étudiante
const X = randomUUID(); // compte dont on change le rôle
const Y = randomUUID(); // étudiant suspendu, abonné à la main
let FORMATION: string;
let STANDARD: string;

type Ligne = { categorie: string; action: string; resume: string; auteur: string | null; auteur_nom: string; details: Record<string, unknown> };
const un = async <T>(sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];
const en = (qui: string, sql: string, params: unknown[] = []) => banc.en({ id: qui } as Qui, sql, params);
const depuis = async (id: number) =>
  (await banc.db.query<Ligne>("select categorie, action, resume, auteur, auteur_nom, details from public.journal_actions where id > $1 order by id", [id])).rows;
const dernier = async () => (await un<{ id: number | null }>("select max(id)::int as id from public.journal_actions")).id ?? 0;
const resumes = async (avant: number) => (await depuis(avant)).map((l) => l.resume);

beforeAll(async () => {
  banc = await creerBanc(migrationsJusqua("0061"));
  await banc.creerCompte(S, ["super_admin"]);
  for (const id of [A, M, E, X, Y]) await banc.creerCompte(id);
  const noms: [string, string, string][] = [[S, "Aïcha", "Kpadé"], [A, "Rodrigue", "Houngbo"], [M, "Gildas", "Tossou"], [E, "Fifamè", "Agossou"], [X, "Jules", "Koffi"], [Y, "Sènami", "Dossou"]];
  for (const [id, prenom, nom] of noms) await banc.db.query("update public.profils set prenom = $2, nom = $3 where id = $1", [id, prenom, nom]);
  await en(S, "select public.changer_role($1, 'admin')", [A]);
  await en(S, "select public.changer_role($1, 'moderateur')", [M]);
  FORMATION = (await un<{ id: string }>("insert into public.formations (titre, slug) values ('Excel', $1) returning id", [randomUUID()])).id;
  STANDARD = (await un<{ id: string }>("select id from public.formules where code = 'standard'")).id;
  await banc.db.query("delete from public.journal_actions");
});

describe("Migration 0061 : le journal des actions", () => {
  it("comptes : rôles, suspension, réactivation, annonce à tous", async () => {
    const avant = await dernier();
    await en(S, "select public.changer_role($1, 'moderateur')", [X]);
    await en(S, "select public.changer_role($1, 'admin')", [X]);
    await en(A, "select public.suspendre_compte($1, 'Spam répété')", [Y]);
    await en(A, "select public.reactiver_compte($1)", [Y]);
    await en(A, "select public.publier_annonce('Nouveautés', 'La page est en ligne.', null)");
    const lignes = await depuis(avant);
    expect(lignes.map((l) => [l.categorie, l.resume])).toEqual([
      ["comptes", "Rôle « Modérateur » donné à Jules Koffi"],
      ["comptes", "Rôle de Jules Koffi : Modérateur → Administrateur"],
      ["comptes", "Compte de Sènami Dossou suspendu"],
      ["comptes", "Compte de Sènami Dossou réactivé"],
      ["comptes", "Annonce « Nouveautés » envoyée à tous"],
    ]);
    expect(lignes[0]).toMatchObject({ auteur: S, auteur_nom: "Aïcha Kpadé" });
    expect(lignes[2].details).toMatchObject({ motif: "Spam répété" });
  });

  it("paiements : prix, code promo, activation, abonnement attribué puis annulé", async () => {
    const avant = await dernier();
    await en(A, "select public.regler_formule($1, 12000, false, true)", [STANDARD]);
    await en(A, "select public.regler_formule($1, 15000, false, true)", [STANDARD]);
    const code = (await en(A, "select public.enregistrer_code_promo(null, 'PROMO20', 'pourcentage', 20, null, null, null, true) as id")) as { id: string }[];
    await en(A, "select public.enregistrer_code_promo($1, 'PROMO20', 'pourcentage', 25, null, null, null, true)", [code[0].id]);
    await en(S, "select public.activer_paiements($1)", ["j".repeat(64)]);
    const carte = (await en(A, "select public.attribuer_abonnement($1, $2, 'especes', 15000, 'REF-1') as c", [Y, STANDARD])) as { c: unknown }[];
    expect(carte[0].c).toBeTruthy();
    const abonnement = (await un<{ id: string }>("select id from public.abonnements where profil_id = $1", [Y])).id;
    await en(A, "select public.annuler_abonnement($1, 'Remboursé')", [abonnement]);
    const lignes = await depuis(avant);
    const fin = (await un<{ d: string }>("select public.date_longue(fin) as d from public.abonnements where id = $1", [abonnement])).d;
    expect(lignes.map((l) => [l.categorie, l.resume])).toEqual([
      ["paiements", "Prix de Standard fixé à 12 000 FCFA"],
      ["paiements", "Prix de Standard : 12 000 → 15 000 FCFA"],
      ["paiements", "Code promo PROMO20 créé"],
      ["paiements", "Code promo PROMO20 modifié"],
      ["paiements", "Paiements activés"],
      ["paiements", `Abonnement Standard attribué à Sènami Dossou jusqu’au ${fin}`],
      ["paiements", "Abonnement Standard de Sènami Dossou annulé"],
    ]);
    expect(lignes.at(-1)?.details).toMatchObject({ motif: "Remboursé" });
  });

  it("contenus : statut d'une formation, version notée, formation supprimée", async () => {
    const avant = await dernier();
    await en(A, "update public.formations set statut = 'publiee' where id = $1", [FORMATION]);
    const brouillon = (await en(A, "insert into public.formations (titre, slug) values ('Brouillon', $1) returning id", [randomUUID()])) as { id: string }[];
    await en(A, "delete from public.formations where id = $1", [brouillon[0].id]);
    expect(await resumes(avant)).toEqual([
      "Formation « Excel » : Brouillon → Publiée",
      "Version 1 de « Excel » : Mise en ligne",
      "Formation « Brouillon » supprimée",
    ]);
  });

  it("communauté : avis masqué, publication supprimée, annonce épinglée, réglage de l'analyse", async () => {
    const avis = (await un<{ id: string }>("insert into public.avis (profil_id, formation_id, note, commentaire) values ($1, $2, 4, 'Bien') returning id", [E, FORMATION])).id;
    const publication = (await un<{ id: string }>("insert into public.publications (auteur, texte) values ($1, 'Bonjour') returning id", [E])).id;
    const jeton = (await un<{ jeton: string }>("select jeton from public.reglages_moderation")).jeton;
    const avant = await dernier();
    await en(M, "select public.masquer_avis($1, true)", [avis]);
    await en(M, "select public.masquer_avis($1, false)", [avis]);
    await en(M, "select public.supprimer_contenu($1, null)", [publication]);
    await en(M, "select public.enregistrer_annonce(true, 'Bienvenue', 'Le mot de l’équipe', null, null, null, 'tous', null)");
    await en(M, "select public.enregistrer_annonce(true, 'Bienvenue à tous', 'Le mot de l’équipe', null, null, null, 'tous', null)");
    await en(M, "select public.retirer_annonce()");
    await en(M, "select public.regler_analyse(true, $1)", [jeton]);
    const lignes = await depuis(avant);
    expect(lignes.map((l) => [l.categorie, l.resume])).toEqual([
      ["communaute", "Avis de Fifamè Agossou sur « Excel » masqué"],
      ["communaute", "Avis de Fifamè Agossou sur « Excel » réaffiché"],
      ["communaute", "Publication de Fifamè Agossou supprimée"],
      ["communaute", "Annonce épinglée publiée"],
      ["communaute", "Annonce épinglée modifiée"],
      ["communaute", "Annonce épinglée retirée"],
      ["communaute", "Analyse automatique activée"],
    ]);
    expect(lignes[0]).toMatchObject({ auteur: M, auteur_nom: "Gildas Tossou" });
  });

  it("point reporté : modifier le commentaire d'un autre est au journal ; son propre commentaire, non", async () => {
    const publication = (await un<{ id: string }>("insert into public.publications (auteur, texte) values ($1, 'Question') returning id", [E])).id;
    const commentaire = (await un<{ id: string }>("insert into public.commentaires_publications (publication_id, auteur, texte) values ($1, $2, 'Réponse brute') returning id", [publication, E])).id;
    const avant = await dernier();
    await en(M, "select public.modifier_commentaire($1, 'Réponse corrigée par l’équipe')", [commentaire]);
    await en(E, "select public.modifier_commentaire($1, 'Réponse corrigée par son autrice')", [commentaire]);
    expect(await depuis(avant)).toMatchObject([{ categorie: "communaute", resume: "Commentaire de Fifamè Agossou modifié", auteur: M }]);
  });

  it("une action d'étudiant, ou faite sans compte (tâche planifiée), n'écrit rien", async () => {
    const avant = await dernier();
    const publication = (await un<{ id: string }>("insert into public.publications (auteur, texte) values ($1, 'À effacer') returning id", [E])).id;
    await en(E, "select public.supprimer_publication($1)", [publication]);
    await banc.db.query("update public.formations set statut = 'archivee' where id = $1", [FORMATION]);
    expect(await depuis(avant)).toEqual([]);
  });

  it("Review Focus 3 : personne n'écrit, ne modifie ni n'efface une ligne ; journaliser est interne", async () => {
    const id = await dernier();
    for (const qui of [A, S]) {
      await expect(en(qui, "insert into public.journal_actions (categorie, action, resume) values ('comptes', 'faux', 'Faux')")).rejects.toThrow();
      await expect(en(qui, "update public.journal_actions set resume = 'Effacé' where id = $1", [id])).rejects.toThrow();
      await expect(en(qui, "delete from public.journal_actions where id = $1", [id])).rejects.toThrow();
      await expect(en(qui, "select public.journaliser('comptes', 'faux', null, null, null, 'Faux')")).rejects.toThrow();
    }
  });

  it("lire le journal : le super admin seul ; filtres par catégorie, auteur, période ; pages", async () => {
    await expect(en(A, "select public.lire_journal(null, null, null, null)")).rejects.toThrow();
    await expect(en(M, "select public.auteurs_journal()")).rejects.toThrow();
    const lire = async (categorie: string | null, auteur: string | null, jours: number | null, avant: number | null, nombre = 50) =>
      ((await en(S, "select public.lire_journal($1, $2, $3, $4, $5) as r", [categorie, auteur, jours, avant, nombre])) as { r: { lignes: { id: number; categorie: string; auteur: string | null; resume: string }[]; suite: boolean } }[])[0].r;
    const tout = await lire(null, null, null, null);
    expect(tout.lignes.length).toBeGreaterThan(10);
    expect(tout.lignes[0].id).toBeGreaterThan(tout.lignes[1].id);
    expect((await lire("communaute", null, null, null)).lignes.every((l) => l.categorie === "communaute")).toBe(true);
    expect((await lire(null, M, null, null)).lignes.every((l) => l.auteur === M)).toBe(true);
    await banc.db.query("update public.journal_actions set cree_le = now() - interval '40 days' where resume like 'Rôle%'");
    expect((await lire("comptes", null, 30, null)).lignes.some((l) => l.resume.startsWith("Rôle"))).toBe(false);
    const page1 = await lire(null, null, null, null, 2);
    expect(page1).toMatchObject({ suite: true });
    const page2 = await lire(null, null, null, page1.lignes[1].id, 2);
    expect(page2.lignes[0].id).toBeLessThan(page1.lignes[1].id);
    const auteurs = ((await en(S, "select public.auteurs_journal() as a")) as { a: { id: string; nom: string }[] }[])[0].a;
    expect(auteurs.map((a) => a.nom).sort()).toEqual(["Aïcha Kpadé", "Gildas Tossou", "Rodrigue Houngbo"]);
  });
});
