"use server";

import { getShellUser } from "@/lib/auth/current-user";
import { createClient } from "@/lib/supabase/server";

// Les nouvelles sessions live d'un compte (spec promotion des sessions live, §3 ; migration 0024) : programmées depuis
// sa dernière visite de la page Événements. Elles alimentent le bouton « Sessions live programmées » et la pastille rouge
// de l'entrée Événements ; une erreur ou l'absence de la 0024 donne 0, sans rien casser.

/** Le nombre de nouvelles sessions ; 0 sans session, avant la 0024 ou si la base ne répond pas. */
export async function compterNouvellesSessions(): Promise<number> {
  if (!(await getShellUser())) return 0;
  try {
    const { data, error } = await (await createClient()).rpc("nouvelles_sessions");
    if (error) return 0;
    const n = typeof data === "number" ? data : Number(data);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** La page Événements a été ouverte : les sessions programmées jusqu'ici ne sont plus nouvelles. */
export async function marquerEvenementsVus(): Promise<void> {
  if (!(await getShellUser())) return;
  try {
    await (await createClient()).rpc("marquer_evenements_vus");
  } catch {
    // Ignoré : la pastille restera jusqu'à la prochaine visite.
  }
}
