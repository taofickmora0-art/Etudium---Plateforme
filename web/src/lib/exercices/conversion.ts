import { liste, texte, un } from "@/lib/contenus/lecture";
import { documentLu } from "@/lib/lecon/document";
import type { CorrectionAFaire, ExerciceEtudiant, ExerciceListe, GenreExercice, RenduACorriger, StatutRendu, VersionRendu } from "./types";

// Les réponses des fonctions de la 0032, converties pour l'appli.

export const MIGRATION_EXERCICES = "Appliquez la migration 0032 (guide « Ce qui te revient », section 38).";

const nombre = (valeur: unknown) => Number(valeur) || 0;
const date = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
export const versGenre = (valeur: unknown): GenreExercice => (valeur === "simple" ? "simple" : "rendu");
export const versStatut = (valeur: unknown): StatutRendu => (valeur === "a_corriger" || valeur === "valide" ? valeur : "en_attente");

export const versVersion = (v: Record<string, unknown>): VersionRendu => ({
  id: texte(v.id),
  version: nombre(v.version),
  nomFichier: texte(v.nom_fichier),
  format: texte(v.format),
  tailleOctets: nombre(v.taille_octets),
  message: texte(v.message),
  statut: versStatut(v.statut),
  remarque: texte(v.remarque),
  correcteur: texte(v.correcteur) || null,
  corrigeLe: date(v.corrige_le),
  creeLe: texte(v.cree_le),
  aUnFichier: v.a_un_fichier === true,
});

export function versExercice(data: unknown): ExerciceEtudiant | null {
  const brut = un(data);
  if (!brut) return null;
  return {
    genre: versGenre(brut.genre),
    statut: brut.statut === null || brut.statut === undefined ? null : versStatut(brut.statut),
    peutDeposer: brut.peut_deposer === true,
    versions: liste(brut.versions).map(versVersion),
  };
}

export const versExerciceListe = (e: Record<string, unknown>): ExerciceListe => ({
  leconId: texte(e.lecon_id),
  titre: texte(e.titre),
  genre: versGenre(e.genre),
  formation: texte(e.formation),
  slug: texte(e.slug),
  module: texte(e.module),
  moduleRang: nombre(e.module_rang),
  statut: versStatut(e.statut),
  version: nombre(e.version),
  remarque: texte(e.remarque),
  correcteur: texte(e.correcteur) || null,
  corrigeLe: date(e.corrige_le),
  creeLe: texte(e.cree_le),
});

export const versCorrection = (c: Record<string, unknown>): CorrectionAFaire => ({
  renduId: texte(c.rendu_id),
  etudiant: texte(c.etudiant),
  exercice: texte(c.exercice),
  formation: texte(c.formation),
  formationId: texte(c.formation_id),
  module: texte(c.module),
  moduleRang: nombre(c.module_rang),
  version: nombre(c.version),
  nomFichier: texte(c.nom_fichier),
  deposeLe: texte(c.depose_le),
});

export function versRenduACorriger(data: unknown): RenduACorriger | null {
  const brut = un(data);
  if (!brut) return null;
  const exercice = un(brut.exercice) ?? {};
  const formation = un(brut.formation) ?? {};
  const section = un(brut.module) ?? {};
  return {
    etudiant: texte(brut.etudiant),
    exercice: { id: texte(exercice.id), titre: texte(exercice.titre), genre: versGenre(exercice.genre), consigne: texte(exercice.consigne), consigneDocument: documentLu(exercice.consigne_document) },
    formation: { id: texte(formation.id), titre: texte(formation.titre), slug: texte(formation.slug) },
    module: { titre: texte(section.titre), rang: nombre(section.rang) },
    version: versVersion(un(brut.version) ?? {}),
    derniere: brut.derniere === true,
    historique: liste(brut.historique).map(versVersion),
    suivant: texte(brut.suivant) || null,
  };
}
