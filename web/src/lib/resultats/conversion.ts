import { liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { REGLES_PAR_DEFAUT } from "./calcul";
import type { Categorie, EtatResultats, Note, ParcoursComplet, Regles } from "./types";

// Ce que rend la base (migration 0077) mis aux formes de l'appli, et l'inverse pour les règles.

const nombre = (v: unknown, defaut = 0) => (Number.isFinite(Number(v)) && v !== null && v !== "" ? Number(v) : defaut);
const parOrdre = <T extends { ordre: number }>(a: T, b: T) => a.ordre - b.ordre;

export function versCategories(v: unknown): Categorie[] {
  return liste(v)
    .filter((c) => texte(c.cle))
    .map((c) => ({ cle: texte(c.cle), nom: texte(c.nom), poids: nombre(c.poids), ...(c.examen === true ? { examen: true } : {}) }));
}

export function versRegles(v: unknown): Regles {
  const r = un(v);
  if (!r) return REGLES_PAR_DEFAUT;
  const categories = versCategories(r.categories);
  return {
    seuilUe: nombre(r.seuil_ue, REGLES_PAR_DEFAUT.seuilUe),
    seuilSemestre: nombre(r.seuil_semestre, REGLES_PAR_DEFAUT.seuilSemestre),
    compensation: r.compensation === true,
    rattrapage: r.rattrapage === "meilleure" ? "meilleure" : "remplace",
    categories: categories.length ? categories : REGLES_PAR_DEFAUT.categories,
  };
}

/** Les règles au format de la base. */
export const versReglesBase = (r: Regles) => ({
  seuil_ue: r.seuilUe,
  seuil_semestre: r.seuilSemestre,
  compensation: r.compensation,
  rattrapage: r.rattrapage,
  categories: r.categories.map((c) => ({ cle: c.cle, nom: c.nom.trim(), poids: c.poids, ...(c.examen ? { examen: true } : {}) })),
});

export const versEtat = (v: unknown): EtatResultats => {
  const e = un(v) ?? {};
  return { pin: e.pin === true, ouvert: e.ouvert === true, bloqueJusqua: texte(e.bloque_jusqua) || null, propose: e.propose === true };
};

/** Un parcours lu avec ses semestres, UE, ECUE et notes imbriqués, remis à plat et dans l'ordre. */
export function versParcoursComplet(v: unknown): ParcoursComplet | null {
  const p = un(v);
  if (!p || !texte(p.id)) return null;
  const semestres = liste(p.semestres_scolaires);
  const ues = semestres.flatMap((s) => liste(s.ue_scolaires));
  const ecues = ues.flatMap((u) => liste(u.ecue_scolaires));
  const notes = ecues.flatMap((e) => liste(e.notes_scolaires));
  return {
    parcours: { id: texte(p.id), nom: texte(p.nom), etablissement: texte(p.etablissement), regles: versRegles(p.regles), ordre: nombre(p.ordre) },
    semestres: semestres.map((s) => ({ id: texte(s.id), parcoursId: texte(s.parcours_id), nom: texte(s.nom), annee: texte(s.annee), ordre: nombre(s.ordre) })).sort(parOrdre),
    ues: ues
      .map((u) => ({ id: texte(u.id), semestreId: texte(u.semestre_id), code: texte(u.code), intitule: texte(u.intitule), credits: nombre(u.credits), ordre: nombre(u.ordre) }))
      .sort(parOrdre),
    // Le barème du parcours vaut pour toutes les ECUE (décision du 5 novembre 2026) : un barème propre d'avant est ignoré.
    ecues: ecues
      .map((e: Ligne) => ({ id: texte(e.id), ueId: texte(e.ue_id), intitule: texte(e.intitule), poids: nombre(e.poids, 1), bareme: null, ordre: nombre(e.ordre) }))
      .sort(parOrdre),
    notes: notes
      .map(
        (n): Note => ({
          id: texte(n.id),
          ecueId: texte(n.ecue_id),
          categorie: texte(n.categorie),
          libelle: texte(n.libelle),
          note: nombre(n.note),
          sur: nombre(n.sur, 20),
          rattrapage: n.rattrapage === true,
          date: texte(n.date) || null,
          creeLe: texte(n.cree_le),
        }),
      )
      .sort((a, b) => (a.date ?? a.creeLe).localeCompare(b.date ?? b.creeLe) || a.creeLe.localeCompare(b.creeLe)),
  };
}

/** Ce que lit la page : un parcours et tout ce qu'il contient, en un seul appel. */
export const COLONNES_PARCOURS =
  "id, nom, etablissement, regles, ordre, semestres_scolaires(id, parcours_id, nom, annee, ordre, ue_scolaires(id, semestre_id, code, intitule, credits, ordre, ecue_scolaires(id, ue_id, intitule, poids, bareme, ordre, notes_scolaires(id, ecue_id, categorie, libelle, note, sur, rattrapage, date, cree_le))))";
