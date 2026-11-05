import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

// Banc d'essai SQL : un vrai Postgres (PGlite, en WebAssembly, sans Docker) avec un faux Supabase autour.
// Les migrations y sont exécutées telles qu'elles seront collées dans l'éditeur SQL de Supabase.

/** Qui fait la requête : un visiteur, ou un compte connecté. */
export type Qui = "anon" | { id: string };

export type Banc = {
  /** Accès direct, en superutilisateur (pour préparer les données). */
  db: PGlite;
  /**
   * Exécute une requête comme le ferait l'API pour ce visiteur ou ce compte (rôle et règles d'accès compris).
   * `reglages` : d'autres réglages de la requête, comme les pose PostgREST (`request.headers`, `request.jwt.claims`).
   */
  en<T = Record<string, unknown>>(qui: Qui, sql: string, params?: unknown[], reglages?: Record<string, string>): Promise<T[]>;
  /** Applique un fichier SQL (chemin relatif à web/). */
  appliquer(fichier: string): Promise<void>;
  /** Crée un compte (le déclencheur de la 0001 lui donne profil et rôle étudiant), puis lui ajoute ces rôles. */
  creerCompte(id: string, roles?: string[]): Promise<void>;
};

export const MIGRATIONS_LOT_0 = [
  "supabase/migrations/0001_profils_roles.sql",
  "supabase/migrations/0002_profil.sql",
  "supabase/migrations/0003_finitions.sql",
];

const lire = (fichier: string) => readFileSync(join(process.cwd(), fichier), "utf8");

/** Toutes les migrations, de la 0001 à `derniere` comprise (« 0055 »), dans l'ordre. */
export function migrationsJusqua(derniere: string): string[] {
  return readdirSync(join(process.cwd(), "supabase/migrations"))
    .filter((f) => /^\d{4}_.+\.sql$/.test(f) && f.slice(0, 4) <= derniere)
    .sort()
    .map((f) => `supabase/migrations/${f}`);
}

export async function creerBanc(fichiers: string[]): Promise<Banc> {
  const db = new PGlite();
  await db.exec(lire("tests/db/supabase-simule.sql"));

  const banc: Banc = {
    db,
    async en<T>(qui: Qui, sql: string, params: unknown[] = [], reglages: Record<string, string> = {}) {
      return db.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [qui === "anon" ? "" : qui.id]);
        for (const [nom, valeur] of Object.entries(reglages)) await tx.query("select set_config($1, $2, true)", [nom, valeur]);
        await tx.exec(`set local role ${qui === "anon" ? "anon" : "authenticated"}`);
        const { rows } = await tx.query<T>(sql, params);
        return rows;
      });
    },
    async appliquer(fichier: string) {
      await db.exec(lire(fichier));
    },
    async creerCompte(id: string, roles: string[] = []) {
      await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
        id,
        `${id.slice(0, 8)}@exemple.com`,
        { prenom: "Test", nom: randomUUID().slice(0, 4) },
      ]);
      for (const role of roles) {
        await db.query("insert into public.roles (profil_id, role) values ($1, $2::public.role_etudium) on conflict do nothing", [id, role]);
      }
    },
  };

  for (const fichier of fichiers) await banc.appliquer(fichier);
  return banc;
}
