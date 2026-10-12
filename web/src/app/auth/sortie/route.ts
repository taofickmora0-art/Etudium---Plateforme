import { NextResponse, type NextRequest } from "next/server";
import { clearLocalSession } from "@/lib/auth/local-session";
import { safeNext } from "@/lib/auth/messages";
import { isSessionClosed } from "@/lib/auth/session-state";
import { createClient } from "@/lib/supabase/server";

/**
 * La coque y envoie quand Supabase ne reconnaît plus la session (fermée sur un autre appareil, compte supprimé).
 * Le proxy, qui lit le jeton sur place, le croit encore valable : sans cet effacement, connexion et accueil se renverraient la balle.
 * Une session encore valable n'est pas touchée : un lien piégé vers cette adresse ne déconnecte personne.
 * « next » (la page demandée) est repris dans l'adresse de connexion, s'il reste sur le site.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data?.user) return NextResponse.redirect(new URL("/accueil", request.url));
    // Incident passager de Supabase : on ne touche pas à la session (l'accueil proposera de réessayer).
    if (error && !isSessionClosed(error)) return NextResponse.redirect(new URL("/accueil", request.url));
  } catch {
    // Base injoignable ou pas configurée : on se comporte comme sans session (même règle que le proxy).
  }
  await clearLocalSession();
  const next = safeNext(new URL(request.url).searchParams.get("next"), "");
  const suite = next ? `&next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(new URL(`/connexion?session=expiree${suite}`, request.url));
}
