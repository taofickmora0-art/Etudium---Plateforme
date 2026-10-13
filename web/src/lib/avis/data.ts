import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { AVIS_MAX, ETOILES, resumeDepuis } from "./regles";
import type { AvisEquipe, AvisFormation, Etoiles } from "./types";

// Lecture des avis par les fonctions de la migration 0010 : sans elle, null (la fiche garde « Pas encore d’avis »).

type Reponse = { data: unknown; error: { code?: string; message?: string } | null };

/**
 * Rend les lignes, ou null : fonction pas encore dans la base, ou toute autre erreur. Les avis ne sont qu'une section
 * de la fiche : un incident sur eux ne doit pas mettre la page entière en erreur (il est consigné).
 */
function lignes(reponse: Reponse): Ligne[] | null {
  if (reponse.error) {
    if (!estFonctionAbsente(reponse.error)) console.error("Lecture des avis impossible :", reponse.error.message ?? reponse.error.code);
    return null;
  }
  return liste(reponse.data);
}

const etoiles = (valeur: unknown) => Math.min(5, Math.max(1, Number(valeur) || 1)) as Etoiles;

/** Les avis d'une formation publiée (le sien d'abord, puis les plus récents) et leur résumé. */
export async function lireAvis(formationId: string): Promise<AvisFormation | null> {
  if (demoModeActive()) return null;
  const supabase = await createClient();
  const [avis, repartition] = await Promise.all([
    supabase.rpc("avis_formation", { p_formation: formationId, p_limite: AVIS_MAX }),
    supabase.rpc("repartition_avis", { p_formation: formationId }),
  ]);
  const lus = lignes(avis);
  const comptes = lignes(repartition);
  if (!lus || !comptes) return null;
  const parNote = Object.fromEntries(ETOILES.map((n) => [n, 0])) as Record<Etoiles, number>;
  for (const c of comptes) parNote[etoiles(c.note)] += Number(c.nombre ?? 0);
  return {
    avis: lus.map((a) => ({
      id: String(a.id),
      note: etoiles(a.note),
      commentaire: texte(a.commentaire),
      auteur: texte(a.auteur),
      initiales: texte(a.initiales),
      creeLe: texte(a.cree_le),
      modifieLe: texte(a.modifie_le),
      estMoi: a.est_moi === true,
      masque: a.masque === true,
    })),
    resume: resumeDepuis(parNote),
  };
}

/** Tous les avis, pour l'équipe (vide pour un autre compte, règle de la base) ; null sans la 0010. */
export async function lireAvisEquipe(): Promise<AvisEquipe[] | null> {
  if (demoModeActive()) return [];
  const supabase = await createClient();
  const lus = lignes(await supabase.rpc("avis_equipe"));
  return (
    lus?.map((a) => ({
      id: String(a.id),
      formationTitre: texte(a.formation_titre),
      formationSlug: texte(a.formation_slug),
      auteur: texte(a.auteur),
      note: etoiles(a.note),
      commentaire: texte(a.commentaire),
      masque: a.masque === true,
      creeLe: texte(a.cree_le),
    })) ?? null
  );
}
