import { redirect } from "next/navigation";
import { getShellUser } from "@/lib/auth/current-user";

/**
 * À placer (sous Suspense) dans chaque page de l'espace connecté : une mise en page n'est pas réexécutée à chaque
 * navigation, et le proxy accepte encore un jeton dont la session a été fermée ailleurs (changement de mot de passe,
 * suppression du compte). Supabase ne reconnaît plus la session → /auth/sortie l'efface de l'appareil.
 */
export async function SessionGuard() {
  if (!(await getShellUser())) redirect("/auth/sortie");
  return null;
}
