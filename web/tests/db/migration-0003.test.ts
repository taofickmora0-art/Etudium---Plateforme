import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pas de Postgres local (pas de Docker) : on vérifie le texte de la migration, appliquée ensuite dans l'éditeur SQL de Supabase.
const sql = () => readFileSync(join(process.cwd(), "supabase/migrations/0003_finitions.sql"), "utf8").toLowerCase();

describe("Migration 0003 : finitions", () => {
  it("la base refuse une adresse de photo forgée", () => {
    const s = sql();
    expect(s).toContain("add constraint profils_photo_chemin");
    expect(s).toContain(String.raw`photo_url is null or photo_url ~ ('^' || id::text || '/[0-9a-f-]{36}\.(jpg|png)$')`);
  });

  it("les photos déjà enregistrées sont converties", () => {
    const s = sql();
    const conversion = s.indexOf("regexp_replace(photo_url, '^.*/photos-profil/', '')");
    expect(conversion).toBeGreaterThan(-1);
    // Une ancienne valeur qui n'est pas une photo Étudium est effacée (initiales) plutôt que de bloquer la contrainte.
    expect(s).toMatch(/set photo_url = null\s+where photo_url is not null and photo_url !~/);
    expect(conversion).toBeLessThan(s.indexOf("add constraint profils_photo_chemin"));
  });

  it("les règles d'accès lisent le rôle une seule fois par requête", () => {
    const s = sql();
    expect(s).not.toMatch(/(?<!select )public\.a_role\(/);
    for (const role of ["admin", "super_admin"]) expect(s).toContain(`(select public.a_role('${role}'))`);
    for (const regle of [
      "chacun lit son profil",
      "chacun lit ses rôles",
      "seul le super admin attribue un rôle",
      "seul le super admin retire un rôle",
    ]) {
      expect(s).toContain(`drop policy if exists "${regle}"`);
      expect(s).toContain(`create policy "${regle}"`);
    }
  });

  it("le fichier est rejouable", () => {
    const s = sql();
    expect(s).toContain("drop constraint if exists profils_photo_chemin");
  });
});
