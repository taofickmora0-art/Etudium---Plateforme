import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lireMigrations, regrouper, TAILLE_MAX, texteDePartie } from "../../scripts/assembler-migrations.mjs";

// Les fichiers SQL de la base de production (spec de la mise en ligne, §1.3) : produits par
// scripts/assembler-migrations.mjs et commités. Une nouvelle migration sans relancer le script fait échouer ce test.
const SORTIE = join(process.cwd(), "supabase", "production");

type Migration = { nom: string; sql: string };

describe("Le regroupement des migrations", () => {
  it("garde l'ordre, ne coupe jamais une migration, et respecte la taille visée", () => {
    const migrations: Migration[] = [
      { nom: "0001_a.sql", sql: "a".repeat(60) },
      { nom: "0002_b.sql", sql: "b".repeat(50) },
      { nom: "0003_c.sql", sql: "c".repeat(120) },
      { nom: "0004_d.sql", sql: "d".repeat(10) },
    ];
    const parties: Migration[][] = regrouper(migrations, 100);
    expect(parties.map((p) => p.map((m) => m.nom))).toEqual([["0001_a.sql"], ["0002_b.sql"], ["0003_c.sql"], ["0004_d.sql"]]);
    expect(regrouper(migrations, 200).map((p: Migration[]) => p.map((m) => m.nom))).toEqual([["0001_a.sql", "0002_b.sql"], ["0003_c.sql", "0004_d.sql"]]);
  });

  it("chaque partie dit quoi en faire et nomme ses migrations", () => {
    const texte: string = texteDePartie([{ nom: "0001_a.sql", sql: "select 1;\n" }], 1, 2);
    expect(texte).toContain("partie 1 sur 2 (migrations 0001 à 0001)");
    expect(texte).toContain("Ensuite : partie 2.");
    expect(texte).toContain("-- ═══ 0001_a.sql ═══\nselect 1;");
  });
});

describe("Les fichiers de supabase/production", () => {
  const migrations: Migration[] = lireMigrations();
  const attendues: Migration[][] = regrouper(migrations);

  it("ne contiennent que des migrations, jamais les exemples", () => {
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.every((m) => /^\d{4}_/.test(m.nom))).toBe(true);
  });

  it("suivent les migrations : sinon, relancer `node scripts/assembler-migrations.mjs`", () => {
    expect(existsSync(SORTIE)).toBe(true);
    const fichiers = readdirSync(SORTIE).filter((f) => f.endsWith(".sql")).sort((a, b) => Number(a.match(/\d+/)?.[0]) - Number(b.match(/\d+/)?.[0]));
    expect(fichiers).toEqual(attendues.map((_, i) => `partie-${i + 1}.sql`));
    attendues.forEach((partie, i) => {
      expect(readFileSync(join(SORTIE, fichiers[i]), "utf8")).toBe(texteDePartie(partie, i + 1, attendues.length));
      expect(partie.length === 1 || partie.reduce((t, m) => t + m.sql.length, 0) <= TAILLE_MAX).toBe(true);
    });
  });
});
