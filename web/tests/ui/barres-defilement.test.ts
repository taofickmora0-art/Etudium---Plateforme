import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Pas de barre de défilement, nulle part (ta demande du 11 novembre 2026) : la page, les fenêtres, les tableaux et les
// rangées défilent toujours (molette, doigt, pavé tactile, clavier), sans barre visible.

const RACINE = join(process.cwd(), "src");
const fichiers = (dossier: string): string[] =>
  readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    return statSync(chemin).isDirectory() ? fichiers(chemin) : /\.(tsx?|css)$/.test(nom) ? [chemin] : [];
  });

describe("Les barres de défilement", () => {
  it("masquées pour tous les éléments (Firefox, Chrome, Edge, Safari)", () => {
    const css = readFileSync(join(RACINE, "app", "globals.css"), "utf8").replace(/\s+/g, " ");
    expect(css).toContain("* { scrollbar-width: none; }");
    expect(css).toContain("*::-webkit-scrollbar { display: none; }");
  });

  it("aucun élément ne remet une barre fine", () => {
    const fautifs = fichiers(RACINE).filter((f) => readFileSync(f, "utf8").includes("scrollbar-width:thin"));
    expect(fautifs).toEqual([]);
  });
});
