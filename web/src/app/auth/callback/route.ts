import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/messages";
import { cheminFormateur, formateurSansEspaceEtudiant } from "@/lib/auth/espace-formateur";
import { rediriger } from "@/lib/auth/redirection";
import { estSuspendu } from "@/lib/auth/suspension";
import { createClient } from "@/lib/supabase/server";

/** Retour de Google : échange le code contre une session, puis va à la page demandée (jamais hors du site). */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // Compte suspendu (spec des utilisateurs, §4) : la session tout juste ouverte est aussitôt refermée.
        if (await estSuspendu(supabase)) {
          await supabase.auth.signOut();
          return rediriger("/connexion?erreur=suspendu");
        }
        // Un formateur arrive dans son espace (restructuration R1).
        return rediriger((await formateurSansEspaceEtudiant(supabase)) ? cheminFormateur(next) : next);
      }
    } catch {
      // Base injoignable ou non configurée : même issue qu'un échec.
    }
  }
  return rediriger(`/connexion?erreur=google&next=${encodeURIComponent(next)}`);
}
