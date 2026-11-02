import type { StatutFiche } from "@/lib/catalogue/data";
import { dureeLisible, estLeconDeContenu } from "@/lib/catalogue/regles";
import type { FicheFormation } from "@/lib/catalogue/types";
import type { Inscription } from "@/lib/inscriptions/types";
import { etatFormation, type EtatProgression } from "@/lib/progression/regles";
import type { LigneProgression } from "@/lib/progression/types";

// Règles de « Mes formations » (spec du lot 1, §8) : les formations où le compte est inscrit, même à 0 % (0069 ; spec du
// 2 novembre 2026, §2). Sans la 0069, comme avant : les formations commencées, au moins une leçon ouverte.

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
 * Les formations suivies, de la plus récemment ouverte (ou rejointe) à la plus ancienne. Avec les inscriptions lues
 * (`inscriptions`, 0069) : celles où le compte est inscrit, commencées ou non ; un aperçu ouvert sans inscription n'en
 * fait pas une formation suivie. Sans la 0069 (null) : les formations commencées. Verrouillée : archivée (R24), ou plus
 * aucune leçon ouverte alors qu'elle n'est pas terminée (abonnement échu). Inscrite sans leçon ouverte : elle mène à sa
 * première leçon ouverte (c'est aussi sa leçon où reprendre), et se classe à sa date d'inscription.
 */
export function formationsSuivies(
  fiches: FicheSuivie[],
  lignes: LigneProgression[],
  favoris: ReadonlySet<string>,
  inscriptions: readonly Inscription[] | null = null,
): FormationSuivie[] {
  const inscritLe = inscriptions ? new Map(inscriptions.map((i) => [i.formationId, i.inscritLe])) : null;
  const suivies: FormationSuivie[] = [];
  for (const fiche of fiches) {
    const lue = etatFormation(fiche, lignes);
    const inscription = inscritLe?.get(fiche.id);
    if (inscritLe ? inscription === undefined : !lue.commencee) continue;
    // Pas encore commencée : on part de la première leçon ouverte ; une formation sans leçon n'a rien à fermer. Des aperçus
    // seuls ouverts (formation payante, abonnement échu) ne l'ouvrent pas : elle reste fermée.
    const contenu = fiche.modules.flatMap((m) => m.lecons).filter(estLeconDeContenu);
    const seulsApercus = contenu.some((l) => !l.apercu) && !contenu.some((l) => l.accessible && !l.apercu);
    const aReprendre = lue.commencee ? lue.aReprendre : seulsApercus ? null : (contenu.find((l) => l.accessible) ?? null);
    const progression: EtatProgression = { ...lue, aReprendre };
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

/**
 * Les formations dont lire la fiche pour `formationsSuivies` : celles où le compte est inscrit (0069) ; sans la 0069
 * (`inscriptions` null), celles qu'il a commencées.
 */
export function formationsALire(lignes: readonly LigneProgression[] | null, inscriptions: readonly Inscription[] | null): string[] {
  return [...new Set(inscriptions ? inscriptions.map((i) => i.formationId) : (lignes ?? []).map((l) => l.formationId))];
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
