import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pas de Postgres local (pas de Docker) : on vérifie le texte de la migration, que l'utilisateur
// applique ensuite dans l'éditeur SQL de Supabase.
const sql = () => readFileSync(join(process.cwd(), "supabase/migrations/0001_profils_roles.sql"), "utf8").toLowerCase();

describe("Migration profils et rôles", () => {
  it("crée les deux tables avec leurs règles d'accès", () => {
    const s = sql();
    expect(s).toContain("create table if not exists public.profils");
    expect(s).toContain("create table if not exists public.roles");
    expect(s).toContain("alter table public.profils enable row level security");
    expect(s).toContain("alter table public.roles enable row level security");
  });

  it("crée le profil et le rôle étudiant à chaque inscription", () => {
    const s = sql();
    expect(s).toMatch(/create trigger \w+\s+after insert on auth\.users/);
    expect(s).toContain("'etudiant'");
  });

  it("protège les fonctions qui contournent les règles d'accès", () => {
    const s = sql();
    const definers = s.match(/security definer/g) ?? [];
    const searchPaths = s.match(/set search_path = ''/g) ?? [];
    expect(definers.length).toBeGreaterThan(0);
    expect(searchPaths.length).toBeGreaterThanOrEqual(definers.length);
  });

  it("ne contient aucune clé secrète", () => {
    const s = sql();
    expect(s).not.toContain("service_role");
    expect(s).not.toContain("sb_secret_");
  });
});
