import { randomUUID } from "node:crypto";
import { migrationsJusqua, type Banc } from "./banc";

// Aide des tests du lot 6 B (migration 0063) : des formations posées directement en base (superutilisateur), gratuites
// pour qu'un compte connecté y ait accès sans abonnement.

export const MIGRATIONS_ENGAGEMENT = [...migrationsJusqua("0062"), "supabase/migrations/0063_engagement.sql"];

export type FormationTest = { id: string; slug: string; titre: string; lecons: string[]; quiz: string | null; question: string | null; exercice: string | null };

export type OptionsFormation = {
  lecons?: number;
  quiz?: boolean;
  exercice?: "simple" | "rendu" | null;
  statut?: "publiee" | "brouillon" | "archivee" | "desactivee";
  parcours?: string[];
  ordre?: number;
  publieeLe?: string;
  formateur?: string | null;
};

const un = async <T>(banc: Banc, sql: string, params: unknown[] = []) => (await banc.db.query<T>(sql, params)).rows[0];

export async function creerParcours(banc: Banc, nom: string, couleur: "academique" | "digital" | "business" = "academique"): Promise<string> {
  return (await un<{ id: string }>(banc, "insert into public.parcours (slug, nom, nom_court, couleur) values ($1, $2, $2, $3) returning id", [`p-${randomUUID().slice(0, 8)}`, nom, couleur])).id;
}

/** Une formation : des leçons « lecon » publiées, un quiz d'une question (bonne réponse : le choix 0), un exercice. */
export async function creerFormation(banc: Banc, titre: string, o: OptionsFormation = {}): Promise<FormationTest> {
  const slug = `f-${randomUUID().slice(0, 8)}`;
  const id = (await un<{ id: string }>(banc, "insert into public.formations (titre, slug, gratuite, formateur_id) values ($1, $2, true, $3) returning id", [titre, slug, o.formateur ?? null])).id;
  for (const p of o.parcours ?? []) {
    await banc.db.query("insert into public.formations_parcours (formation_id, parcours_id, ordre) values ($1, $2, $3)", [id, p, o.ordre ?? 0]);
  }
  const mod = (await un<{ id: string }>(banc, "insert into public.modules (formation_id, titre, ordre) values ($1, 'Module 1', 1) returning id", [id])).id;
  const lecon = async (titreLecon: string, type: string, ordre: number, genre: string | null = null, publiee = true) =>
    (await un<{ id: string }>(banc, "insert into public.lecons (module_id, titre, type, genre_exercice, publiee, ordre, duree_secondes) values ($1, $2, $3, $4, $5, $6, 600) returning id", [mod, titreLecon, type, genre, publiee, ordre])).id;
  const lecons: string[] = [];
  for (let i = 1; i <= (o.lecons ?? 2); i++) lecons.push(await lecon(`Leçon ${i}`, "lecon", i));
  let quiz: string | null = null;
  let question: string | null = null;
  if (o.quiz ?? true) {
    quiz = await lecon("Quiz du module 1", "quiz", 50, null, false);
    question = (
      await un<{ id: string }>(banc, "insert into public.questions_quiz (lecon_id, genre, enonce, choix) values ($1, 'unique', 'Quel outil ?', $2::jsonb) returning id", [
        quiz,
        JSON.stringify([{ texte: "Zotero", correcte: true }, { texte: "Excel", correcte: false }]),
      ])
    ).id;
    await banc.db.query("update public.lecons set publiee = true where id = $1", [quiz]);
  }
  const exercice = o.exercice === null ? null : await lecon("Tableau des ventes", "exercice", 60, o.exercice ?? "rendu");
  await banc.db.query("update public.formations set statut = 'publiee' where id = $1", [id]);
  if (o.publieeLe) {
    // La date de première publication est figée par la base (0004) : on la pose sans les déclencheurs.
    await banc.db.exec("set session_replication_role = replica");
    await banc.db.query(`update public.formations set publiee_le = ${o.publieeLe} where id = $1`, [id]);
    await banc.db.exec("set session_replication_role = origin");
  }
  if (o.statut && o.statut !== "publiee") await banc.db.query("update public.formations set statut = $2 where id = $1", [id, o.statut]);
  return { id, slug, titre, lecons, quiz, question, exercice };
}

/** Un certificat posé directement (sans remplir les conditions), daté de `creeLe` (expression SQL). */
export async function poserCertificat(banc: Banc, profil: string, formation: FormationTest, creeLe = "now()"): Promise<string> {
  return (
    await un<{ id: string }>(
      banc,
      `insert into public.certificats (identifiant, profil_id, formation_id, titulaire, formation_titre, delivre_le, cree_le)
       values ($1, $2, $3, 'Aïcha Kpadé', $4, current_date, ${creeLe}) returning id`,
      [`ET-${randomUUID().slice(0, 8)}`, profil, formation.id, formation.titre],
    )
  ).id;
}
