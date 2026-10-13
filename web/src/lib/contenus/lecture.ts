// Outils de lecture des contenus du lot 1, partagés par le back-office et le catalogue.

/** Les tables du lot 1 ne sont pas encore dans la base : la migration 0004 n'a pas été appliquée. */
export class TablesAbsentesError extends Error {
  constructor() {
    super("Tables du lot 1 absentes : migration 0004 à appliquer.");
    this.name = "TablesAbsentesError";
  }
}

/** Reconnaît l'erreur par son nom : une même classe peut exister en deux exemplaires selon le chargement des modules. */
export const estTablesAbsentes = (erreur: unknown) => erreur instanceof Error && erreur.name === "TablesAbsentesError";

type ErreurSupabase = { code?: string; message?: string } | null;
const TABLES_ABSENTES = new Set(["PGRST205", "42P01"]);

/** Rend les données, ou lève : TablesAbsentesError si les tables du lot 1 manquent, une erreur sinon. */
export function verifier<T>(reponse: { data: T; error: ErreurSupabase }): T {
  if (reponse.error) {
    if (reponse.error.code && TABLES_ABSENTES.has(reponse.error.code)) throw new TablesAbsentesError();
    throw new Error(reponse.error.message ?? "Lecture des contenus impossible.");
  }
  return reponse.data;
}

/** Une colonne d'une migration pas encore appliquée (note des avis, 0010). */
export const estColonneAbsente = (erreur: ErreurSupabase) => erreur?.code === "42703";
/** Une fonction d'une migration pas encore appliquée (PostgREST : PGRST202 ; Postgres : 42883). */
export const estFonctionAbsente = (erreur: ErreurSupabase) => erreur?.code === "PGRST202" || erreur?.code === "42883";

export type Ligne = Record<string, unknown>;
/** Une relation « un à un » arrive en objet ou en tableau selon ce que Supabase devine : on accepte les deux. */
export const un = (valeur: unknown): Ligne | null =>
  Array.isArray(valeur) ? ((valeur[0] as Ligne | undefined) ?? null) : ((valeur as Ligne | null) ?? null);
export const liste = (valeur: unknown): Ligne[] => (Array.isArray(valeur) ? (valeur as Ligne[]) : []);
export const texte = (valeur: unknown) => (typeof valeur === "string" ? valeur : "");
export const textes = (valeur: unknown) => (Array.isArray(valeur) ? valeur.filter((v): v is string => typeof v === "string") : []);
export const parOrdre = <T extends { ordre: number }>(a: T, b: T) => a.ordre - b.ordre;
