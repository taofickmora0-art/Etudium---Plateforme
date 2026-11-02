import type { StatutFiche } from "@/lib/catalogue/data";
import { dureeLisible, estLeconDeContenu } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { Inscription } from "@/lib/inscriptions/types";
import { etatFormation, type EtatProgression } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";

// Règles de « Mes formations » (spec du lot 1, §8) : les formations commencées, au moins une leçon ouverte, et celles où
// le compte est inscrit, même à 0 % (0069 ; spec du 2 novembre 2026, §2).

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
  /** « 2 h restantes », « 4 h 10 suivies », « Accès fermé », « Momentanément indisponible ». */
  temps: string;
  /** Désactivée par l'équipe (lot 5, étape C) : « Indisponible » au lieu de « Verrouillée ». */
  indisponible: boolean;
  derniereVisite: string;
};

/**
 * Les formations suivies, de la plus récemment ouverte (ou rejointe) à la plus ancienne : commencées, ou inscrites
 * (`inscriptions`, 0069). Verrouillée : archivée (R24), ou plus aucune leçon ouverte alors qu'elle n'est pas terminée
 * (aperçus vus d'une formation payante ; abonnement échu au lot 2). Inscrite sans leçon ouverte : elle mène à sa
 * première leçon ouverte, et se classe à sa date d'inscription.
 */
export function formationsSuivies(
  fiches: FicheSuivie[],
  lignes: LigneProgression[],
  favoris: ReadonlySet<string>,
  inscriptions: readonly Inscription[] = [],
): FormationSuivie[] {
  const inscritLe = new Map(inscriptions.map((i) => [i.formationId, i.inscritLe]));
  const suivies: FormationSuivie[] = [];
  for (const fiche of fiches) {
    const progression = etatFormation(fiche, lignes);
    const inscription = inscritLe.get(fiche.id);
    if (!progression.commencee && inscription === undefined) continue;
    // Pas encore commencée : on part de la première leçon ouverte ; une formation sans leçon n'a rien à fermer.
    const aReprendre = progression.commencee ? progression.aReprendre : (fiche.modules.flatMap((m) => m.lecons).find((l) => l.accessible && estLeconDeContenu(l)) ?? null);
    const fermee = !progression.terminee && !aReprendre && (progression.commencee || progression.total > 0);
    const etat: EtatSuivi = fiche.statut !== "publiee" || fermee ? "verrouillee" : progression.terminee ? "terminee" : "enCours";
    const restant = dureeLisible(progression.restantSecondes);
    const indisponible = fiche.statut === "desactivee";
    const temps = indisponible ? "Momentanément indisponible" : etat === "verrouillee" ? "Accès fermé" : etat === "terminee" ? `${dureeLisible(fiche.dureeSecondes)} suivies` : restant ? `${restant} restantes` : "";
    const href = fiche.statut !== "publiee" ? null : aReprendre ? `/formations/${fiche.slug}/lecons/${aReprendre.id}` : `/formations/${fiche.slug}`;
    const visites = [...lignes.filter((l) => l.formationId === fiche.id).map((l) => l.vueLe), ...(inscription === undefined ? [] : [inscription])];
    const derniereVisite = visites.reduce((max, v) => (Date.parse(v) > Date.parse(max) ? v : max), visites[0]);
    suivies.push({ fiche, etat, progression, favori: favoris.has(fiche.id), href, temps, indisponible, derniereVisite });
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
