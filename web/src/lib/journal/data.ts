import { demoModeActive } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { estCategorieJournal, type AuteurJournal, type FiltresJournal, type PageJournal } from "./types";

// Lire le journal (migration 0061, réservé au super admin : la base le vérifie).

const PAR_PAGE = 50;

type LigneBrute = { id?: unknown; cree_le?: unknown; auteur_nom?: unknown; categorie?: unknown; resume?: unknown };

/** null : démo ou migration 0061 absente ; une autre erreur remonte (page d'erreur, ou « Voir plus » qui le dit). */
export async function lireJournal(filtres: FiltresJournal, avant?: string): Promise<PageJournal | null> {
  if (demoModeActive()) return null;
  const { data, error } = await (await createClient()).rpc("lire_journal", {
    p_categorie: filtres.categorie,
    p_auteur: filtres.auteur,
    p_jours: filtres.jours,
    p_avant: avant && /^\d+$/.test(avant) ? Number(avant) : null,
    p_nombre: PAR_PAGE,
  });
  if (error) {
    if (estFonctionAbsente(error)) return null;
    throw new Error(`Lecture du journal impossible (${error.code ?? "?"}).`);
  }
  if (!data) return null;
  const brut = data as { lignes?: LigneBrute[]; suite?: unknown };
  return {
    lignes: (brut.lignes ?? []).map((l) => ({
      id: String(l.id),
      creeLe: String(l.cree_le),
      auteurNom: String(l.auteur_nom ?? ""),
      categorie: estCategorieJournal(l.categorie) ? l.categorie : "comptes",
      resume: String(l.resume ?? ""),
    })),
    suite: brut.suite === true,
  };
}

export async function lireAuteursJournal(): Promise<AuteurJournal[]> {
  if (demoModeActive()) return [];
  try {
    const { data, error } = await (await createClient()).rpc("auteurs_journal");
    if (error || !Array.isArray(data)) return [];
    return (data as { id?: unknown; nom?: unknown }[]).map((a) => ({ id: String(a.id), nom: String(a.nom ?? "") }));
  } catch {
    return [];
  }
}
