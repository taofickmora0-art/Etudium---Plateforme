import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Un composant client (« use client ») ne peut pas importer une valeur d'un module serveur (qui importe
// next/headers ou le client Supabase serveur) : Next refuse de compiler (`next build`). Vitest et tsc ne le voient pas ;
// ce test, si. Les actions serveur (« use server ») et les imports de types seulement sont permis.

const SRC = join(process.cwd(), "src");

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.(ts|tsx)$/.test(nom) ? [chemin] : [];
  });
}

const SERVEUR = /from "(next\/headers|@\/lib\/supabase\/server)"/;

function resoudre(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;
  const base = join(SRC, specifier.slice(2));
  for (const candidat of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    try {
      if (statSync(candidat).isFile()) return candidat;
    } catch {
      // essai suivant
    }
  }
  return null;
}

describe("Les composants clients", () => {
  it("n'importent aucune valeur d'un module serveur", () => {
    const fautes: string[] = [];
    for (const fichier of fichiers(SRC)) {
      const code = readFileSync(fichier, "utf8");
      if (!/^\s*["']use client["']/.test(code)) continue;
      for (const m of code.matchAll(/^import\s+(?!type\b)([^;]*?)\s+from\s+"([^"]+)";/gm)) {
        const noms = /\{([^}]*)\}/.exec(m[1])?.[1].split(",").map((n) => n.trim()).filter(Boolean) ?? [];
        if (noms.length > 0 && noms.every((n) => n.startsWith("type ")) && !m[1].replace(/\{[^}]*\}/, "").trim()) continue;
        const cible = resoudre(m[2]);
        if (!cible) continue;
        const contenu = readFileSync(cible, "utf8");
        if (/^\s*["']use server["']/.test(contenu)) continue;
        if (SERVEUR.test(contenu)) fautes.push(`${fichier.slice(SRC.length + 1)} → ${m[2]}`);
      }
    }
    expect(fautes).toEqual([]);
  });
});

// L'inverse : un fichier serveur (sans « use client ») ne peut appeler une fonction (ni lire une constante) d'un module
// « use client » : il n'en reçoit qu'une référence, et la page tombe en erreur à l'exécution seulement (« Attempted to
// call estFiltreLivres() from the server but estFiltreLivres is on the client », 4 novembre 2026). Seuls les composants
// (nom en majuscule initiale, hors CONSTANTES) et les types s'importent d'un module client. Un fichier partagé qui a
// besoin d'une fonction client est lui-même du code client : il le dit par « use client ».

function resoudreDepuis(fichier: string, specifier: string): string | null {
  if (specifier.startsWith("@/")) return resoudre(specifier);
  if (!specifier.startsWith(".")) return null;
  const base = join(fichier, "..", specifier);
  for (const candidat of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    try {
      if (statSync(candidat).isFile()) return candidat;
    } catch {
      // essai suivant
    }
  }
  return null;
}

const estComposant = (nom: string) => /^[A-Z]/.test(nom) && !/^[A-Z0-9_]+$/.test(nom);

describe("Les fichiers serveur", () => {
  it("n'importent d'un module client que des composants et des types", () => {
    const fautes: string[] = [];
    for (const fichier of fichiers(SRC)) {
      const code = readFileSync(fichier, "utf8");
      if (/^\s*["']use client["']/.test(code)) continue;
      for (const m of code.matchAll(/^import\s+(?!type\b)([^;]*?)\s+from\s+"([^"]+)";/gm)) {
        const cible = resoudreDepuis(fichier, m[2]);
        if (!cible || !/^\s*["']use client["']/.test(readFileSync(cible, "utf8"))) continue;
        const noms = (/\{([^}]*)\}/.exec(m[1])?.[1].split(",") ?? [])
          .map((n) => n.trim())
          .filter((n) => n && !n.startsWith("type "))
          .map((n) => n.split(/\s+as\s+/)[0].trim());
        for (const nom of noms) {
          if (!estComposant(nom)) fautes.push(`${fichier.slice(SRC.length + 1)} → ${nom} (${m[2]})`);
        }
      }
    }
    expect(fautes).toEqual([]);
  });
});
