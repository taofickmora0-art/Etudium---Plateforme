import { rediriger } from "@/lib/auth/redirection";
import { estSuspendu } from "@/lib/auth/suspension";
import { createClient } from "@/lib/supabase/server";

/**
 * Compte suspendu (spec des utilisateurs, §4) : ferme la session, puis annonce la suspension sur la page de connexion.
 * Une page ne peut pas fermer la session elle-même (elle n'écrit pas de cookies) : getShellUser envoie ici.
 * Un compte actif n'est jamais déconnecté par cette adresse : il repart vers l'accueil.
 */
export async function GET() {
  const supabase = await createClient();
  if (!(await estSuspendu(supabase))) return rediriger("/accueil");
  await supabase.auth.signOut();
  return rediriger("/connexion?erreur=suspendu");
}
