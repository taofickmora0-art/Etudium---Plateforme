import type { StatutFiche } from "@/lib/catalogue/data";
import { dureeLisible } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import { etatFormation, type EtatProgression } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";

// Règles de « Mes formations » (spec du lot 1, §8) : les formations commencées, au moins une leçon ouverte.

export type FicheSuivie = FicheFormation & { statut: StatutFiche };
export type EtatSuivi = "enCours" | "terminee" | "verrouillee";
export type FiltreMesFormations = "toutes" | "enCours" | "terminees" | "verrouillees" | "favoris";

export type FormationSuivie = {
  fiche: FicheSuivie;
  etat: EtatSuivi;
  progression: EtatProgression;
  favori: boolean;
  /** Leçon où reprendre, sinon la fiche (offre d'une formation verrouillée) ; null pour une formation archivée, qui n'a plus de fiche. */
  href: string | null;
  /** « 2 h restantes », « 4 h 10 suivies », « Accès fermé ». */
  temps: string;
  derniereVisite: string;
};

/**
 * Les formations suivies, de la plus récemment ouverte à la plus ancienne. Verrouillée : archivée (R24), ou plus aucune
 * leçon ouverte alors qu'elle n'est pas terminée (aperçus vus d'une formation payante ; abonnement échu au lot 2).
 */
export function formationsSuivies(fiches: FicheSuivie[], lignes: LigneProgression[], favoris: ReadonlySet<string>): FormationSuivie[] {
  const suivies: FormationSuivie[] = [];
  for (const fiche of fiches) {
    const progression = etatFormation(fiche, lignes);
    if (!progression.commencee) continue;
    const etat: EtatSuivi = fiche.statut !== "publiee" || (!progression.terminee && !progression.aReprendre) ? "verrouillee" : progression.terminee ? "terminee" : "enCours";
    const restant = dureeLisible(progression.restantSecondes);
    const temps = etat === "verrouillee" ? "Accès fermé" : etat === "terminee" ? `${dureeLisible(fiche.dureeSecondes)} suivies` : restant ? `${restant} restantes` : "";
    const href =
      fiche.statut !== "publiee" ? null : progression.aReprendre ? `/formations/${fiche.slug}/lecons/${progression.aReprendre.id}` : `/formations/${fiche.slug}`;
    const visites = lignes.filter((l) => l.formationId === fiche.id).map((l) => l.vueLe);
    const derniereVisite = visites.reduce((max, v) => (Date.parse(v) > Date.parse(max) ? v : max), visites[0]);
    suivies.push({ fiche, etat, progression, favori: favoris.has(fiche.id), href, temps, derniereVisite });
  }
  return suivies.sort((a, b) => Date.parse(b.derniereVisite) - Date.parse(a.derniereVisite));
}

/** Filtres de la page : « En cours » compte aussi les formations commencées à 0 %. */
export function filtrer(suivies: FormationSuivie[], filtre: FiltreMesFormations): FormationSuivie[] {
  switch (filtre) {
    case "enCours":
      return suivies.filter((s) => s.etat === "enCours");
    case "terminees":
      return suivies.filter((s) => s.etat === "terminee");
    case "verrouillees":
      return suivies.filter((s) => s.etat === "verrouillee");
    case "favoris":
      return suivies.filter((s) => s.favori);
    default:
      return suivies;
  }
}
