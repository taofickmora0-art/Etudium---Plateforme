import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";

/** Retour de Google : échange le code contre une session, puis va à la page demandée (jamais hors du site). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch {
      // Base injoignable ou non configurée : même issue qu'un échec.
    }
  }
  return NextResponse.redirect(`${origin}/connexion?erreur=google&next=${encodeURIComponent(next)}`);
}
