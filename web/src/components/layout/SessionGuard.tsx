import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getShellUser } from "@/lib/auth/current-user";
import { cheminFormateur } from "@/lib/auth/espace-formateur";
import { canAccess } from "@/lib/auth/permissions";
import { EN_TETE_CHEMIN } from "@/lib/auth/routing";
import { redirectToSortie } from "@/lib/auth/sortie";

/**
 * À placer (sous Suspense) dans chaque page de l'espace connecté : une mise en page n'est pas réexécutée à chaque
 * navigation, et le proxy accepte encore un jeton dont la session a été fermée ailleurs (changement de mot de passe,
 * suppression du compte). Supabase ne reconnaît plus la session → /auth/sortie l'efface de l'appareil.
 * Un formateur n'a plus l'espace étudiant (restructuration R1) : il va à l'équivalent de la page dans son espace.
 */
export async function SessionGuard() {
  const user = await getShellUser();
  if (!user) return redirectToSortie();
  if (!canAccess("etudiant", user.roles)) redirect(cheminFormateur((await headers()).get(EN_TETE_CHEMIN) ?? "/accueil"));
  return null;
}
