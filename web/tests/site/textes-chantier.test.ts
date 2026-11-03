import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Aucun texte affiché ne trahit le chantier : ni lot, ni « Bientôt disponible », ni fichier de migration… Seuls
// comptent les textes (chaînes, gabarits, texte JSX) : les commentaires du code restent libres. Les pages de démonstration
// (/vitrine, /etat) ne s'ouvrent pas en production.

const SRC = join(process.cwd(), "src");
const EXCLUS = ["app/vitrine", "app/etat"];
const chemin = (fichier: string) => relative(SRC, fichier).split(sep).join("/");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const complet = join(dossier, nom);
    if (statSync(complet).isDirectory()) return EXCLUS.includes(chemin(complet)) ? [] : fichiers(complet);
    return /\.tsx?$/.test(nom) ? [complet] : [];
  });
}

/** Les textes d'un fichier : chaînes, gabarits (sans leurs expressions) et texte JSX, hors imports. */
function textes(fichier: string): string[] {
  const source = ts.createSourceFile(fichier, readFileSync(fichier, "utf8"), ts.ScriptTarget.Latest, true, fichier.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const trouves: string[] = [];
  const visite = (n: ts.Node) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) trouves.push(n.text);
    else if (ts.isTemplateExpression(n)) trouves.push([n.head.text, ...n.templateSpans.map((s) => s.literal.text)].join("…"));
    else if (ts.isJsxText(n) && n.text.trim()) trouves.push(n.text.replace(/\s+/g, " ").trim());
    ts.forEachChild(n, visite);
  };
  visite(source);
  return trouves;
}

const CHANTIER = [/\blots? \d/i, /disponible au lot/i, /bientôt disponible/i, /\btâche \d/i, /\bspec\b/i, /fichier 00\d\d/i, /à brancher/i, /\bTODO\b/];

describe("Les textes affichés", () => {
  it("ne parlent ni de lot, ni de fonction « bientôt disponible », ni de fichier de migration", () => {
    const trouves = fichiers(SRC).flatMap((f) => textes(f).filter((t) => CHANTIER.some((motif) => motif.test(t))).map((t) => `${chemin(f)} : ${t}`));
    expect(trouves).toEqual([]);
  });

  it("les pages des étudiants, des formateurs et des visiteurs ne citent aucune migration", () => {
    const groupes = ["app/(app)/(etudiant)", "app/(app)/formateur", "app/(catalogue)", "app/(lecon)", "app/(auth)"];
    const pages = groupes.flatMap((g) => fichiers(join(SRC, g)));
    expect(pages.length).toBeGreaterThan(20);
    const citees = pages.filter((p) => /MIGRATION_|Appliquez la migration|pas encore dans la base/.test(readFileSync(p, "utf8"))).map(chemin);
    expect(citees).toEqual([]);
  });
});
