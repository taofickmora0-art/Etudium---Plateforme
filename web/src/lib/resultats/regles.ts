import type { Categorie, Regles } from "./types";

// Les vérifications de la saisie de « Mes résultats », avant l'envoi (la base revérifie tout, migration 0077). Chaque
// fonction rend le message à afficher, ou null.

const entre = (v: number, min: number, max: number) => Number.isFinite(v) && v >= min && v <= max;

export function refusBareme(categories: Categorie[]): string | null {
  if (categories.length === 0) return "Ajoute au moins un type de notes.";
  if (categories.length > 6) return "Six types de notes au plus.";
  if (categories.some((c) => !c.nom.trim())) return "Donne un nom à chaque type de notes.";
  if (categories.some((c) => !Number.isFinite(c.poids) || c.poids <= 0 || c.poids > 100)) return "Chaque poids va de 1 à 100 %.";
  if (Math.abs(categories.reduce((s, c) => s + c.poids, 0) - 100) > 1e-6) return "Le total des poids doit faire 100 %.";
  if (categories.filter((c) => c.examen).length > 1) return "Un seul type peut être l’examen.";
  return null;
}

export const refusNote = (note: number, sur: number): string | null => {
  if (!entre(sur, 1, 100)) return "Le barème d’une note va de 1 à 100.";
  if (!entre(note, 0, sur)) return `La note doit être entre 0 et ${String(sur).replace(".", ",")}.`;
  return null;
};

export const refusCredits = (credits: number): string | null => (entre(credits, 0.5, 60) ? null : "Les crédits vont de 0,5 à 60.");

export const refusPoids = (poids: number): string | null => (entre(poids, 0.5, 100) ? null : "Les crédits (ou le coefficient) vont de 0,5 à 100.");

export const refusSeuil = (seuil: number): string | null => (entre(seuil, 0, 20) ? null : "Un seuil va de 0 à 20.");

export function refusRegles(regles: Regles): string | null {
  return refusSeuil(regles.seuilUe) ?? refusSeuil(regles.seuilSemestre) ?? refusBareme(regles.categories);
}

/** La clé d'un nouveau type de notes : son nom sans accents ni espaces (« controle-continu »), unique dans le barème. */
export function cleDepuisNom(nom: string, existantes: string[]): string {
  const base =
    nom
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 26) || "type";
  let cle = base;
  for (let i = 2; existantes.includes(cle); i++) cle = `${base}-${i}`;
  return cle;
}
