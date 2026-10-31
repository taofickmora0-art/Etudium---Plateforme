"use server";

import { getShellUser } from "@/lib/auth/current-user";
import { un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { UUID, versAimeurs } from "./data";
import { REPLAYS, type NouvellesPublications } from "./types";

// Le bandeau « Nouvelles publications » (liste du 31 octobre 2026, tâche 9 ; migration 0042) : le fil demande de temps en
// temps ce qui est paru depuis la plus récente qu'il montre. Une erreur ou l'absence de la 0042 donne 0, sans rien casser.

const RIEN: NouvellesPublications = { nombre: 0, auteurs: [] };

/**
 * Les publications parues dans `espace` (« tous », « general », « replays » ou l'identifiant d'un parcours) après
 * `apres` (ISO ; null pour un fil vide : toutes), et leurs trois derniers auteurs ; rien sans session ou si la base ne
 * répond pas.
 */
export async function compterNouvellesPublications(espace: string, apres: string | null): Promise<NouvellesPublications> {
  if (espace !== "tous" && espace !== "general" && espace !== REPLAYS && !UUID.test(espace)) return RIEN;
  if (apres !== null && Number.isNaN(Date.parse(apres))) return RIEN;
  if (!(await getShellUser())) return RIEN;
  try {
    const { data, error } = await (await createClient()).rpc("nouvelles_publications", { p_espace: espace, p_apres: apres });
    const r = un(data);
    const nombre = Number(r?.nombre);
    if (error || !r || !Number.isFinite(nombre) || nombre <= 0) return RIEN;
    return { nombre: Math.floor(nombre), auteurs: versAimeurs(r.auteurs) };
  } catch {
    return RIEN;
  }
}
