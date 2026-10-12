import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pas de Postgres local (pas de Docker) : on vérifie le texte de la migration, appliquée ensuite dans l'éditeur SQL de Supabase.
const sql = () => readFileSync(join(process.cwd(), "supabase/migrations/0002_profil.sql"), "utf8").toLowerCase();

describe("Migration 0002 : profil", () => {
  it("personne ne peut modifier id, cree_le ni modifie_le", () => {
    const s = sql();
    expect(s).toContain("revoke update on public.profils from authenticated, anon");
    const grant = s.match(/grant update \(([^)]*)\)\s+on public\.profils to authenticated/);
    expect(grant).not.toBeNull();
    const colonnes = grant![1].split(",").map((c) => c.trim());
    expect(colonnes).toEqual(
      expect.arrayContaining(["prenom", "nom", "telephone", "pays", "niveau_etudes", "etablissement", "filiere", "objectifs", "photo_url", "preferences_notifications"]),
    );
    for (const interdite of ["id", "cree_le", "modifie_le"]) expect(colonnes).not.toContain(interdite);
  });

  it("la suppression ne touche que le compte connecté", () => {
    const s = sql();
    expect(s).toContain("create or replace function public.supprimer_mon_compte()");
    const fonction = s.slice(s.indexOf("create or replace function public.supprimer_mon_compte()"));
    expect(fonction).toContain("security definer");
    expect(fonction).toContain("set search_path = ''");
    expect(fonction).toContain("where id = (select auth.uid())");
    expect(fonction).toMatch(/if \(select auth\.uid\(\)\) is null then\s+raise exception/);
    expect(s).toContain("revoke execute on function public.supprimer_mon_compte() from public, anon");
    expect(s).toContain("grant execute on function public.supprimer_mon_compte() to authenticated");
  });

  it("les photos sont lisibles par leur adresse", () => {
    expect(sql()).toMatch(/update storage\.buckets set public = true where id = 'photos-profil'/);
  });

  it("le fichier est rejouable", () => {
    const s = sql();
    const contraintes = s.match(/add constraint/g) ?? [];
    const blocs = s.match(/exception\s+when duplicate_object then null/g) ?? [];
    expect(contraintes.length).toBe(8);
    expect(blocs.length).toBeGreaterThanOrEqual(contraintes.length);
  });

  it("ne contient aucune clé secrète", () => {
    const s = sql();
    expect(s).not.toContain("service_role");
    expect(s).not.toContain("sb_secret_");
  });
});
