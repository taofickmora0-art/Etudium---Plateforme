import { getShellUser } from "@/lib/auth/current-user";
import { aDomaine, type Domaine } from "@/lib/auth/domaines";
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

export const ACCES_DOMAINE = "Vous n’avez pas accès à cette partie du back-office.";

/**
 * Les actions d'un domaine du back-office (lot 6 A, spec §1.2) : contenus, utilisateurs, paiements… Le modérateur
 * n'a que la communauté ; la base revérifie (0060).
 */
export async function exigerDomaine(domaine: Domaine): Promise<{ supabase: Supabase } | { erreur: string }> {
  const user = await getShellUser();
  if (!user) return { erreur: SESSION_EXPIREE };
  // Hors de l'équipe : le message de toujours ; un membre hors de son domaine : celui du domaine.
  if (!canAccess("admin", user.roles)) return { erreur: ACCES_EQUIPE };
  if (!aDomaine(user.roles, domaine)) return { erreur: ACCES_DOMAINE };
  return { supabase: await createClient() };
}

export const ACCES_FORMATEUR = "Accès réservé aux formateurs.";

/** Le suivi des étudiants : l'espace formateur (rôle formateur seulement ; l'équipe n'a pas cet espace). */
export async function exigerFormateur(): Promise<{ supabase: Supabase } | { erreur: string }> {
  const user = await getShellUser();
  if (!user) return { erreur: SESSION_EXPIREE };
  if (!canAccess("formateur", user.roles)) return { erreur: ACCES_FORMATEUR };
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
  // Les contenus sont au domaine « contenus » (lot 6 A) : un modérateur n'est pas éditeur.
  const equipe = aDomaine(user.roles, "contenus");
  if (!equipe && !user.roles.includes("formateur")) return { erreur: canAccess("admin", user.roles) ? ACCES_DOMAINE : ACCES_EDITEUR };
  return { supabase: await createClient(), equipe };
}

/**
 * Les sessions live (lot 6 A) : elles relèvent de la communauté. Le modérateur, l'admin et le super admin les gèrent
 * toutes (et choisissent l'animateur) ; un formateur, les siennes (la base le vérifie, 0018 et 0036).
 */
export async function exigerAnimateur(): Promise<{ supabase: Supabase; equipe: boolean } | { erreur: string }> {
  const user = await getShellUser();
  if (!user) return { erreur: SESSION_EXPIREE };
  const equipe = aDomaine(user.roles, "communaute");
  if (!equipe && !user.roles.includes("formateur")) return { erreur: ACCES_EDITEUR };
  return { supabase: await createClient(), equipe };
}
