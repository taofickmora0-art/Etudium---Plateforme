import { estFonctionAbsente, liste, texte, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import type { Lecture } from "@/lib/utilisateurs/types";
import { versEtatSuivi, type EtatSuivi } from "./suivi";

// L'onglet « Apprenants » d'une formation (refonte des formations, étape C, migration 0029) : qui suit la formation,
// sa progression et son état. Pour l'équipe et le formateur de la formation ; jamais d'adresse e-mail.

export const MIGRATION_APPRENANTS = "Appliquez la migration 0029 (guide « Ce qui te revient », section 35).";

export type LigneApprenant = {
  etudiantId: string;
  prenom: string;
  nom: string;
  terminees: number;
  total: number;
  premiereOuverture: string;
  derniereActivite: string;
  etat: EtatSuivi;
};

export type PageApprenants = {
  /** Toute la formation, quels que soient les filtres. */
  resume: { apprenants: number; progressionMoyenne: number; terminees: number; aRisque: number };
  /** Les apprenants retenus par les filtres. */
  total: number;
  lignes: LigneApprenant[];
};

const nombre = (valeur: unknown) => Number(valeur) || 0;

/** Une page des apprenants, telle que la rend la fonction apprenants_formation. */
export function versApprenants(data: unknown): PageApprenants {
  const brut = un(data);
  const resume = un(brut?.resume);
  return {
    resume: {
      apprenants: nombre(resume?.apprenants),
      progressionMoyenne: nombre(resume?.progression_moyenne),
      terminees: nombre(resume?.terminees),
      aRisque: nombre(resume?.a_risque),
    },
    total: nombre(brut?.total),
    lignes: liste(brut?.lignes).map((l) => ({
      etudiantId: texte(l.etudiant_id),
      prenom: texte(l.prenom),
      nom: texte(l.nom),
      terminees: nombre(l.terminees),
      total: nombre(l.total),
      premiereOuverture: texte(l.premiere_ouverture),
      derniereActivite: texte(l.derniere_activite),
      etat: versEtatSuivi(l.etat),
    })),
  };
}

/** La première page de l'onglet ; migrationAbsente avant la 0029 ; toute autre erreur va à l'écran d'erreur. */
export async function lireApprenants(formationId: string): Promise<Lecture<PageApprenants>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apprenants_formation", { p_formation: formationId, p_recherche: "", p_etat: "tous", p_page: 1 });
  if (error) {
    if (estFonctionAbsente(error)) return { migrationAbsente: true };
    throw new Error(`Lecture des apprenants impossible : ${error.message ?? error.code}`);
  }
  return { migrationAbsente: false, donnees: versApprenants(data) };
}
