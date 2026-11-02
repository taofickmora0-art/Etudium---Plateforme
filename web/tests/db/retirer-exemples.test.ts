import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { abonner } from "./abonner";
import { creerBanc, migrationsJusqua, type Banc } from "./banc";
import { creerFormation, poserCertificat, type FormationTest } from "./engagement-banc";

// Script supabase/exemples/retirer-lot-1.sql (spec du 2 novembre 2026, §8) : retire les dix formations d'exemple du lot 1
// et tout ce qui en dépend, puis la fiche « Dr Mireille Adjovi » si elle n'a ni compte, ni formation, ni session live.
// Les trois parcours restent. Rejouable. Lancé une fois dans l'éditeur SQL de Supabase (rôle postgres).

const EXEMPLES = "supabase/exemples/lot-1.sql";
const RETRAIT = "supabase/exemples/retirer-lot-1.sql";
const SLUGS = [
  "maitriser-microsoft-excel",
  "microsoft-word-travaux-universitaires",
  "zotero-gerer-ses-references",
  "powerpoint-reussir-sa-soutenance",
  "methodologie-du-memoire",
  "canva-debutant-a-expert",
  "intelligence-artificielle-etudes",
  "montage-video-smartphone",
  "marketing-digital-debutants",
  "lancer-son-activite-freelance",
];
const PARCOURS = ["reussite-academique", "competences-digitales", "business-revenus-en-ligne"];
const MIREILLE = "Dr Mireille Adjovi";

type Bilan = Record<string, number>;

const lire = (fichier: string) => readFileSync(join(process.cwd(), fichier), "utf8");

/** Lance le script comme dans l'éditeur SQL (tout le fichier d'un coup) ; rend le bilan affiché à la fin. */
async function retirer(banc: Banc): Promise<Bilan> {
  const resultats = await banc.db.exec(lire(RETRAIT));
  const lignes = resultats.at(-1)?.rows as { bilan: string; nombre: number }[];
  return Object.fromEntries(lignes.map((l) => [l.bilan, l.nombre]));
}

const nombre = async (banc: Banc, sql: string, params: unknown[] = []) => (await banc.db.query<{ n: number }>(sql, params)).rows[0].n;
const ids = async (banc: Banc, sql: string, params: unknown[] = []) => (await banc.db.query<{ id: string }>(sql, params)).rows.map((r) => r.id);
const idParcours = async (banc: Banc, slug: string) => (await ids(banc, "select id from public.parcours where slug = $1", [slug]))[0];
const idFormation = async (banc: Banc, slug: string) => (await ids(banc, "select id from public.formations where slug = $1", [slug]))[0];

describe("Retrait des formations d'exemple du lot 1", () => {
  let banc: Banc;
  let premier: Bilan;
  let second: Bilan;
  const [E, T] = [randomUUID(), randomUUID()]; // E : abonnée, inscrite à Excel ; T : inscrite à Zotero (gratuite)
  let exemples: string[]; // les dix formations d'exemple
  let leconsExcel: string[];
  let certificatExcel: string;
  let commentaire: string;
  let vraie: FormationTest; // une vraie formation du parcours Réussite académique, suivie par E
  let vente: FormationTest; // une vraie formation Business, liée à Canva (monétisation)
  let certificatVraie: string;

  beforeAll(async () => {
    banc = await creerBanc([...migrationsJusqua("0069"), EXEMPLES]);
    for (const id of [E, T]) await banc.creerCompte(id);
    exemples = await ids(banc, "select id from public.formations where slug = any($1)", [SLUGS]);
    const excel = await idFormation(banc, "maitriser-microsoft-excel");
    leconsExcel = await ids(
      banc,
      "select l.id from public.lecons l join public.modules m on m.id = l.module_id where m.formation_id = $1 order by m.ordre, l.ordre",
      [excel],
    );
    // Sur la base de test, lot-1.sql a été appliqué juste après la 0004 : ses leçons sont publiées (depuis la 0027, une
    // leçon ajoutée naît brouillon).
    await banc.db.query("update public.lecons set publiee = true where id = any($1)", [leconsExcel]);
    vraie = await creerFormation(banc, "Statistiques avec R", { parcours: [await idParcours(banc, "reussite-academique")] });
    vente = await creerFormation(banc, "Vendre ses services en ligne", { parcours: [await idParcours(banc, "business-revenus-en-ligne")] });

    // E, abonnée : inscrite à Excel et à la vraie formation ; une leçon ouverte, une terminée (points), une note, un commentaire.
    await abonner(banc, E);
    for (const f of [excel, vraie.id]) await banc.en({ id: E }, "select public.s_inscrire_formation($1)", [f]);
    await banc.en({ id: T }, "select public.s_inscrire_formation($1)", [await idFormation(banc, "zotero-gerer-ses-references")]);
    await banc.en({ id: E }, "select public.ouvrir_lecon($1)", [leconsExcel[2]]);
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [leconsExcel[0]]);
    await banc.en({ id: E }, "select public.terminer_lecon($1)", [vraie.lecons[0]]);
    await banc.db.query("insert into public.notes_lecons (profil_id, lecon_id, texte) values ($1, $2, 'À revoir')", [E, leconsExcel[2]]);
    commentaire = (await ids(banc, "insert into public.commentaires_lecons (lecon_id, auteur, texte) values ($1, $2, 'Merci !') returning id", [leconsExcel[2], E]))[0];
    await banc.db.query("insert into public.reactions_commentaires_lecons (commentaire_id, profil_id) values ($1, $2)", [commentaire, T]);

    // Favoris, avis, certificats.
    for (const f of [excel, vraie.id]) await banc.db.query("insert into public.favoris (profil_id, formation_id) values ($1, $2)", [E, f]);
    await banc.db.query("insert into public.avis (profil_id, formation_id, note, commentaire) values ($1, $2, 5, 'Très clair')", [E, excel]);
    certificatExcel = await poserCertificat(banc, E, { id: excel, titre: "Maîtriser Microsoft Excel" } as FormationTest);
    certificatVraie = await poserCertificat(banc, E, vraie);

    // Brouillons (formation et leçon), monétisation (exemple ↔ exemple, et vraie ↔ exemple), popularité.
    await banc.db.query("insert into public.brouillons_formations (formation_id, donnees, revision) values ($1, '{}', 1)", [excel]);
    await banc.db.query("insert into public.brouillons_lecons (lecon_id, donnees, revision) values ($1, '{}', 1)", [leconsExcel[2]]);
    const canva = await idFormation(banc, "canva-debutant-a-expert");
    for (const business of [await idFormation(banc, "marketing-digital-debutants"), vente.id]) {
      await banc.db.query("insert into public.formations_monetisation (business_id, competence_id) values ($1, $2)", [business, canva]);
    }
    await banc.db.query("select public.rafraichir_popularite()");

    // Notifications : deux vers Excel (formation, leçon), une vers la vraie, une vers une adresse qui ressemble à Excel.
    for (const lien of [
      "/formations/maitriser-microsoft-excel",
      `/formations/maitriser-microsoft-excel/lecons/${leconsExcel[2]}#commentaire-${commentaire}`,
      `/formations/${vraie.slug}`,
      "/formations/maitriser-microsoft-excel-avance",
    ]) {
      await banc.db.query("insert into public.notifications (destinataire, categorie, titre, lien) values ($1, 'nouveaux_contenus', 'Nouveau', $2)", [E, lien]);
    }
    // Un e-mail encore à envoyer vers Zotero (retiré) ; un autre, déjà envoyé, reste dans l'historique.
    for (const statut of ["a_envoyer", "envoye"]) {
      await banc.db.query("insert into public.envois (canal, destinataire, titre, lien, statut) values ('email', $1, 'Zotero', '/formations/zotero-gerer-ses-references', $2)", [
        E,
        statut,
      ]);
    }

    premier = await retirer(banc);
    second = await retirer(banc);
  }, 120_000);

  it("le banc avait bien ses données liées à Excel avant le retrait", () => {
    expect(exemples).toHaveLength(10);
    expect(leconsExcel).toHaveLength(12);
    expect(premier["Formations d’exemple retirées"]).toBe(10);
    expect(premier["Modules retirés"]).toBe(4);
    expect(premier["Leçons retirées"]).toBe(12);
    expect(premier["Inscriptions retirées"]).toBe(2);
    expect(premier["Leçons suivies retirées"]).toBe(2);
    expect(premier["Favoris retirés"]).toBe(1);
    expect(premier["Avis retirés"]).toBe(1);
    expect(premier["Certificats retirés"]).toBe(1);
    expect(premier["Brouillons retirés"]).toBe(2);
    expect(premier["Versions retirées"]).toBeGreaterThanOrEqual(10);
    expect(premier["Notifications retirées"]).toBe(2);
    expect(premier["Fiche « Dr Mireille Adjovi » retirée"]).toBe(1);
  });

  it("plus aucune des dix formations d'exemple", async () => {
    expect(await nombre(banc, "select count(*)::int as n from public.formations where slug = any($1) or id = any($2)", [SLUGS, exemples])).toBe(0);
    expect(premier["Formations d’exemple restantes"]).toBe(0);
  });

  it("aucune ligne orpheline : tout ce qui dépendait des formations et des leçons est parti", async () => {
    for (const table of ["modules", "inscriptions_formations", "favoris", "avis", "certificats", "brouillons_formations", "versions_formations", "popularite_formations", "formations_parcours"]) {
      expect(await nombre(banc, `select count(*)::int as n from public.${table} where formation_id = any($1)`, [exemples]), table).toBe(0);
    }
    expect(await nombre(banc, "select count(*)::int as n from public.lecons where id = any($1)", [leconsExcel])).toBe(0);
    for (const table of ["lecons_contenus", "ressources", "progression_lecons", "notes_lecons", "commentaires_lecons", "brouillons_lecons", "questions_quiz", "tentatives_quiz", "rendus_exercices"]) {
      expect(await nombre(banc, `select count(*)::int as n from public.${table} where lecon_id = any($1)`, [leconsExcel]), table).toBe(0);
    }
    expect(await nombre(banc, "select count(*)::int as n from public.reactions_commentaires_lecons where commentaire_id = $1", [commentaire])).toBe(0);
    expect(await nombre(banc, "select count(*)::int as n from public.formations_monetisation where business_id = any($1) or competence_id = any($1)", [exemples])).toBe(0);
    // Sans clé étrangère qui s'efface d'elle-même : certificat détaché, points, notifications, e-mail en attente.
    expect(await nombre(banc, "select count(*)::int as n from public.certificats where formation_id is null or id = $1", [certificatExcel])).toBe(0);
    expect(await nombre(banc, "select count(*)::int as n from public.points_gagnes where reference = any($1)", [[...leconsExcel, certificatExcel]])).toBe(0);
    expect(await nombre(banc, "select count(*)::int as n from public.notifications where lien like '/formations/maitriser-microsoft-excel/%' or lien = '/formations/maitriser-microsoft-excel'")).toBe(0);
    expect(await nombre(banc, "select count(*)::int as n from public.envois where lien = '/formations/zotero-gerer-ses-references' and statut = 'a_envoyer'")).toBe(0);
  });

  it("la fiche de la formatrice d'exemple a disparu", async () => {
    expect(await nombre(banc, "select count(*)::int as n from public.formateurs where nom = $1", [MIREILLE])).toBe(0);
    expect(premier["Fiche « Dr Mireille Adjovi » restante"]).toBe(0);
  });

  it("les trois parcours sont toujours là", async () => {
    const { rows } = await banc.db.query<{ slug: string; actif: boolean }>("select slug, actif from public.parcours order by ordre");
    expect(rows).toEqual(PARCOURS.map((slug) => ({ slug, actif: true })));
    expect(premier["Parcours gardés"]).toBe(3);
  });

  it("les déclencheurs sont réactivés : une formation publiée ne s'efface toujours pas", async () => {
    expect(
      await nombre(banc, "select count(*)::int as n from pg_trigger where tgrelid = 'public.formations'::regclass and not tgisinternal and tgenabled <> 'O'"),
    ).toBe(0);
    const nouvelle = await creerFormation(banc, "Publiée après le retrait", { quiz: false, exercice: null });
    await expect(banc.db.query("delete from public.formations where id = $1", [nouvelle.id])).rejects.toThrow(/s'archive, elle ne s'efface pas/);
  });

  it("relancé, le script ne fait rien et ne casse rien", () => {
    expect(second["Formations d’exemple retirées"]).toBe(0);
    expect(second["Leçons retirées"]).toBe(0);
    expect(second["Fiche « Dr Mireille Adjovi » retirée"]).toBe(0);
    expect(second["Formations d’exemple restantes"]).toBe(0);
    expect(second["Parcours gardés"]).toBe(3);
    expect(second["Autres formations, non touchées"]).toBe(2);
  });

  it("une formation qui n'est pas un exemple n'est pas touchée, ni ce qui la suit", async () => {
    expect(premier["Autres formations, non touchées"]).toBe(2);
    expect(await nombre(banc, "select count(*)::int as n from public.formations where id = any($1) and statut = 'publiee'", [[vraie.id, vente.id]])).toBe(2);
    expect(await nombre(banc, "select count(*)::int as n from public.lecons where id = any($1)", [vraie.lecons])).toBe(vraie.lecons.length);
    expect(await nombre(banc, "select count(*)::int as n from public.formations_parcours where formation_id = any($1)", [[vraie.id, vente.id]])).toBe(2);
    expect(await nombre(banc, "select count(*)::int as n from public.inscriptions_formations where profil_id = $1 and formation_id = $2", [E, vraie.id])).toBe(1);
    expect(await nombre(banc, "select count(*)::int as n from public.progression_lecons where profil_id = $1 and lecon_id = $2", [E, vraie.lecons[0]])).toBe(1);
    expect(await nombre(banc, "select count(*)::int as n from public.favoris where profil_id = $1 and formation_id = $2", [E, vraie.id])).toBe(1);
    expect(await nombre(banc, "select count(*)::int as n from public.certificats where id = $1 and formation_id = $2", [certificatVraie, vraie.id])).toBe(1);
    expect(await nombre(banc, "select count(*)::int as n from public.points_gagnes where reference = any($1)", [[vraie.lecons[0], certificatVraie]])).toBe(2);
    expect(await nombre(banc, "select count(*)::int as n from public.notifications where lien = any($1)", [[`/formations/${vraie.slug}`, "/formations/maitriser-microsoft-excel-avance"]])).toBe(2);
    expect(await nombre(banc, "select count(*)::int as n from public.envois where lien = '/formations/zotero-gerer-ses-references' and statut = 'envoye'")).toBe(1);
    expect(await nombre(banc, "select count(*)::int as n from public.abonnements where profil_id = $1", [E])).toBe(1);
  });

  it("le script ne coupe jamais les clés étrangères (session_replication_role)", () => {
    expect(lire(RETRAIT)).not.toMatch(/session_replication_role/);
  });
});

describe("Retrait : la fiche de Mireille Adjovi n'est retirée que libre", () => {
  let banc: Banc;
  const C = randomUUID();
  const fiche = async () => nombre(banc, "select count(*)::int as n from public.formateurs where nom = $1", [MIREILLE]);

  beforeAll(async () => {
    banc = await creerBanc([...migrationsJusqua("0069"), EXEMPLES]);
    await banc.creerCompte(C);
  }, 120_000);

  it("gardée tant qu'une session live la cite, puis tant qu'un compte y est relié ; retirée ensuite", async () => {
    await banc.db.query(
      "insert into public.sessions_live (titre, debut, lien, formateur_id) select 'Questions sur Excel', now() + interval '2 days', 'https://meet.exemple.com/x', id from public.formateurs where nom = $1",
      [MIREILLE],
    );
    let bilan = await retirer(banc);
    expect(bilan["Formations d’exemple retirées"]).toBe(10);
    expect(bilan["Fiche « Dr Mireille Adjovi » retirée"]).toBe(0);
    expect(bilan["Fiche « Dr Mireille Adjovi » restante"]).toBe(1);
    expect(await fiche()).toBe(1);

    await banc.db.query("delete from public.sessions_live");
    await banc.db.query("update public.formateurs set compte_id = $1 where nom = $2", [C, MIREILLE]);
    bilan = await retirer(banc);
    expect(bilan["Fiche « Dr Mireille Adjovi » restante"]).toBe(1);
    expect(await fiche()).toBe(1);

    await banc.db.query("update public.formateurs set compte_id = null where nom = $1", [MIREILLE]);
    bilan = await retirer(banc);
    expect(bilan["Fiche « Dr Mireille Adjovi » retirée"]).toBe(1);
    expect(await fiche()).toBe(0);
  });
});
