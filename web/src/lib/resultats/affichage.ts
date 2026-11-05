import { formaterNoteVisee, MODELES_BAREME, type ResultatSemestre, type Visee } from "./calcul";
import type { Categorie, Semestre } from "./types";

// Ce que l'écran de « Mes résultats » écrit à partir des calculs (sans dépendance : serveur, client et tests).

/** Une action qui n'arrive pas au serveur (réseau coupé) : les écrans le disent et restent utilisables. */
export const ECHEC_RESEAU = "La connexion a échoué. Vérifie ton réseau, puis réessaie.";

/** « 12,5 » ou « 12.5 » → 12,5 ; NaN si ce n'est pas un nombre. */
export const lireNombre = (texte: string) => (texte.trim() === "" ? NaN : Number(texte.trim().replace(",", ".")));

/** 14.5 → « 14,5 » ; 20 → « 20 » (une note saisie, sans décimales imposées). */
export const formaterNombre = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

export const pluriel = (n: number, mot: string, motPluriel = `${mot}s`) => `${formaterNombre(n)} ${n > 1 ? motPluriel : mot}`;

/** « Contrôle continu 40 % · Examen 60 % ». */
export const detailBareme = (categories: Categorie[]) => categories.map((c) => `${c.nom} ${formaterNombre(c.poids)} %`).join(" · ");

/** Le modèle qui correspond à un barème (mêmes types, mêmes poids), sinon « perso ». */
export function modeleDuBareme(categories: Categorie[]): string {
  // Les noms comptent : « Interrogations · Examens sur table » (40/60) reste le barème de l'école, pas le modèle.
  const signature = (liste: Categorie[]) => liste.map((c) => `${c.cle}:${c.nom.trim()}:${c.poids}:${c.examen ? 1 : 0}`).join("|");
  return MODELES_BAREME.find((m) => signature(m.categories) === signature(categories))?.cle ?? "perso";
}

/** « Ce qu'il te faut » à l'examen pour valider (l'UE, ou une ECUE) ; null quand l'examen n'est plus attendu. */
export function texteVisee(visee: Visee, quoi: "l’UE" | "cette ECUE"): string | null {
  if (visee === null) return null;
  if (visee === "impossible") return `Même 20/20 à l’examen ne suffira pas pour valider ${quoi}.`;
  if (visee === "acquis") return quoi === "l’UE" ? "L’UE est déjà assurée, quelle que soit ta note d’examen." : "Cette ECUE est déjà assurée, quelle que soit ta note d’examen.";
  return `Il te faut au moins ${formaterNoteVisee(visee.note)}/20 à l’examen pour valider ${quoi}.`;
}

/** La moyenne de chaque année universitaire (les semestres qui portent la même), pondérée par les crédits. */
export function bilanAnnees(semestres: Semestre[], resultats: (ResultatSemestre & { semestreId: string })[]): { annee: string; moyenne: number | null; credits: number; creditsAcquis: number }[] {
  const annees = [...new Set(semestres.map((s) => s.annee.trim()).filter(Boolean))];
  return annees.map((annee) => {
    const siens = resultats.filter((r) => semestres.find((s) => s.id === r.semestreId)?.annee.trim() === annee);
    const notes = siens.filter((r) => r.moyenne !== null && r.credits > 0);
    const poids = notes.reduce((s, r) => s + r.credits, 0);
    return {
      annee,
      moyenne: poids > 0 ? notes.reduce((s, r) => s + r.moyenne! * r.credits, 0) / poids : null,
      credits: siens.reduce((s, r) => s + r.credits, 0),
      creditsAcquis: siens.reduce((s, r) => s + r.creditsAcquis, 0),
    };
  });
}
