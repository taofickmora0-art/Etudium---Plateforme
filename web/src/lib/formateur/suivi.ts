import { etatFormation, type EtatFormation } from "@/lib/contenus/etat";
import type { StatutFormation } from "@/lib/contenus/libelles";
import { estFonctionAbsente, liste, texte, un, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";

// Suivi des étudiants par le formateur et tableau de bord du formateur : lectures des fonctions de la migration 0015
// (spec « Étudiants » et tableau de bord du formateur). Jamais d'adresse e-mail : la base ne la livre pas.

export type EtatSuivi = "en_cours" | "a_risque" | "terminee";
export type FiltreSuivi = "tous" | "a_risque" | "terminees";

export type LigneSuivi = {
  etudiantId: string;
  prenom: string;
  nom: string;
  formationId: string;
  formationTitre: string;
  terminees: number;
  total: number;
  derniereActivite: string;
  etat: EtatSuivi;
};

export type PageSuivi = { total: number; lignes: LigneSuivi[] };

export type LeconSuivie = { id: string; titre: string; etat: "terminee" | "ouverte" | "non_ouverte"; termineeLe: string | null; secondes: number };

export type SuiviEtudiant = {
  id: string;
  prenom: string;
  nom: string;
  formations: {
    id: string;
    titre: string;
    terminees: number;
    total: number;
    secondes: number;
    derniereActivite: string;
    etat: EtatSuivi;
    modules: { id: string; titre: string; lecons: LeconSuivie[] }[];
  }[];
  remarque: { texte: string; modifieeLe: string } | null;
};

export type TableauDeBordFormateur = {
  prenom: string;
  formations: { total: number; brouillons: number };
  etudiants: { total: number; ceMois: number };
  progressionMoyenne: number | null;
  aRisque: { etudiantId: string; prenom: string; nom: string; formationId: string; formationTitre: string; jours: number; pourcentage: number }[];
  formationsDetail: {
    id: string;
    titre: string;
    etat: EtatFormation;
    inscrits: number;
    progressionMoyenne: number | null;
    completion: number | null;
    noteMoyenne: number | null;
    nbAvis: number;
  }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ETATS: EtatSuivi[] = ["en_cours", "a_risque", "terminee"];
const ETATS_LECON: LeconSuivie["etat"][] = ["terminee", "ouverte", "non_ouverte"];

const nombre = (valeur: unknown) => Number(valeur) || 0;
const nombreOuNull = (valeur: unknown) => (valeur === null || valeur === undefined ? null : Number(valeur));
const dateOuNull = (valeur: unknown) => (typeof valeur === "string" && valeur ? valeur : null);
const etat = (valeur: unknown): EtatSuivi => (ETATS.includes(valeur as EtatSuivi) ? (valeur as EtatSuivi) : "en_cours");

/** Une page du suivi, telle que la rend la fonction etudiants_formateur. */
export function versPageSuivi(data: unknown): PageSuivi {
  const brut = un(data);
  return {
    total: nombre(brut?.total),
    lignes: liste(brut?.lignes).map((l) => ({
      etudiantId: texte(l.etudiant_id),
      prenom: texte(l.prenom),
      nom: texte(l.nom),
      formationId: texte(l.formation_id),
      formationTitre: texte(l.formation_titre),
      terminees: nombre(l.terminees),
      total: nombre(l.total),
      derniereActivite: texte(l.derniere_activite),
      etat: etat(l.etat),
    })),
  };
}

function versSuiviEtudiant(l: Ligne): SuiviEtudiant {
  const remarque = un(l.remarque);
  return {
    id: texte(l.id),
    prenom: texte(l.prenom),
    nom: texte(l.nom),
    formations: liste(l.formations).map((f) => ({
      id: texte(f.id),
      titre: texte(f.titre),
      terminees: nombre(f.terminees),
      total: nombre(f.total),
      secondes: nombre(f.secondes),
      derniereActivite: texte(f.derniere_activite),
      etat: etat(f.etat),
      modules: liste(f.modules).map((m) => ({
        id: texte(m.id),
        titre: texte(m.titre),
        lecons: liste(m.lecons).map((le) => ({
          id: texte(le.id),
          titre: texte(le.titre),
          etat: ETATS_LECON.includes(le.etat as LeconSuivie["etat"]) ? (le.etat as LeconSuivie["etat"]) : "non_ouverte",
          termineeLe: dateOuNull(le.terminee_le),
          secondes: nombre(le.secondes),
        })),
      })),
    })),
    remarque: remarque ? { texte: texte(remarque.texte), modifieeLe: texte(remarque.modifiee_le) } : null,
  };
}

function versTableauDeBord(l: Ligne): TableauDeBordFormateur {
  const formations = un(l.formations);
  const etudiants = un(l.etudiants);
  return {
    prenom: texte(l.prenom),
    formations: { total: nombre(formations?.total), brouillons: nombre(formations?.brouillons) },
    etudiants: { total: nombre(etudiants?.total), ceMois: nombre(etudiants?.ce_mois) },
    progressionMoyenne: nombreOuNull(l.progression_moyenne),
    aRisque: liste(l.a_risque).map((r) => ({
      etudiantId: texte(r.etudiant_id),
      prenom: texte(r.prenom),
      nom: texte(r.nom),
      formationId: texte(r.formation_id),
      formationTitre: texte(r.formation_titre),
      jours: nombre(r.jours),
      pourcentage: nombre(r.pourcentage),
    })),
    formationsDetail: liste(l.formations_detail).map((f) => ({
      id: texte(f.id),
      titre: texte(f.titre),
      etat: etatFormation({ statut: f.statut as StatutFormation, envoyeeLe: dateOuNull(f.envoyee_le), renvoyeeLe: dateOuNull(f.renvoyee_le) }),
      inscrits: nombre(f.inscrits),
      progressionMoyenne: nombreOuNull(f.progression_moyenne),
      completion: nombreOuNull(f.completion),
      noteMoyenne: nombreOuNull(f.note_moyenne),
      nbAvis: nombre(f.nb_avis),
    })),
  };
}

type Erreur = { code?: string; message?: string };

/** Rend la lecture, migrationAbsente sans la 0015, et relance toute autre erreur (écran d'erreur de l'espace). */
function lecture<T>(quoi: string, error: Erreur | null, convertir: () => T): Lecture<T> {
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture ${quoi} impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: convertir() };
}

/** Une page de 25 lignes (étudiant, formation) des étudiants du formateur connecté. */
export async function lireSuivi(recherche: string, formationId: string | null, filtre: FiltreSuivi, page: number): Promise<Lecture<PageSuivi>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("etudiants_formateur", { p_recherche: recherche, p_formation: formationId, p_etat: filtre, p_page: page });
  return lecture("du suivi", error, () => versPageSuivi(data));
}

/** La fiche d'un étudiant ; null s'il ne suit aucune des formations du formateur (ou si l'identifiant n'en est pas un). */
export async function lireSuiviEtudiant(id: string): Promise<Lecture<SuiviEtudiant | null>> {
  if (!UUID.test(id)) return { migrationAbsente: false, donnees: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("etudiant_formateur", { p_etudiant: id });
  return lecture("de l'étudiant", error, () => {
    const ligne = un(data);
    return ligne ? versSuiviEtudiant(ligne) : null;
  });
}

/** Le tableau de bord du formateur connecté (design NdFormateur). */
export async function lireTableauDeBordFormateur(): Promise<Lecture<TableauDeBordFormateur>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("tableau_de_bord_formateur");
  return lecture("du tableau de bord", error, () => versTableauDeBord(un(data) ?? {}));
}
