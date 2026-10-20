import { redirect } from "next/navigation";
import { getShellUser, type ShellUser } from "./current-user";
import { accueilDe } from "./espace-formateur";
import { canAccess, type Espace } from "./permissions";
import { redirectToSortie } from "./sortie";

/**
 * À appeler en tête de chaque page réservée (et plus tard au plus près des données), jamais dans une mise en page :
 * une mise en page n'est pas réexécutée à chaque navigation (guide Next « Layouts and auth checks »).
 * Les rôles sont relus en base à chaque requête : un rôle retiré prend effet tout de suite.
 */
export async function requireSpace(espace: Espace): Promise<ShellUser> {
  const user = await getShellUser();
  if (!user) return redirectToSortie();
  // Refusé : l'accueil du compte (le tableau de bord pour un formateur, l'Accueil pour les autres).
  if (!canAccess(espace, user.roles)) redirect(accueilDe(user.roles));
  return user;
}
