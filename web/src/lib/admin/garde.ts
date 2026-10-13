import { getShellUser } from "@/lib/auth/current-user";
import { canAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
export const ACCES_EQUIPE = "Accès réservé à l’équipe.";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Chaque action du back-office commence par là : on ne fait jamais confiance au navigateur (une requête peut être
 * recopiée par n'importe quel compte). L'équipe, ce sont les rôles moderateur, admin et super_admin, les mêmes que
 * la fonction equipe_contenus() de la base, qui revérifie de son côté.
 */
export async function exigerEquipe(): Promise<{ supabase: Supabase } | { erreur: string }> {
  const user = await getShellUser();
  if (!user) return { erreur: SESSION_EXPIREE };
  if (!canAccess("admin", user.roles)) return { erreur: ACCES_EQUIPE };
  return { supabase: await createClient() };
}

export const ACCES_EDITEUR = "Accès réservé aux formateurs et à l’équipe.";

/**
 * Les actions de contenu (formations, programme, leçons, ressources, couvertures) : l'équipe, ou un formateur
 * (spec de l'espace formateur, §6). Pour un formateur, la base vérifie que la formation est bien la sienne
 * (migration 0014) et refuse tout réglage de l'équipe.
 */
export async function exigerEditeur(): Promise<{ supabase: Supabase; equipe: boolean } | { erreur: string }> {
  const user = await getShellUser();
  if (!user) return { erreur: SESSION_EXPIREE };
  const equipe = canAccess("admin", user.roles);
  if (!equipe && !user.roles.includes("formateur")) return { erreur: ACCES_EDITEUR };
  return { supabase: await createClient(), equipe };
}
