import { NextResponse, type NextRequest } from "next/server";
import { estSuspendu } from "@/lib/auth/suspension";
import { createClient } from "@/lib/supabase/server";

/**
 * Compte suspendu (spec des utilisateurs, §4) : ferme la session, puis annonce la suspension sur la page de connexion.
 * Une page ne peut pas fermer la session elle-même (elle n'écrit pas de cookies) : getShellUser envoie ici.
 * Un compte actif n'est jamais déconnecté par cette adresse : il repart vers l'accueil.
 */
export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  if (!(await estSuspendu(supabase))) return NextResponse.redirect(`${origin}/accueil`);
  await supabase.auth.signOut();
  return NextResponse.redirect(`${origin}/connexion?erreur=suspendu`);
}
