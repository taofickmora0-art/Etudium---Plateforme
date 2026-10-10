import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNext } from "@/lib/auth/messages";
import { createClient } from "@/lib/supabase/server";

/**
 * Lien reçu par e-mail (« Mot de passe oublié ») : vérifie le jeton, ouvre une session,
 * puis va à la page demandée (jamais hors du site). Lien expiré → nouvelle demande.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));
  if (tokenHash && type) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) return NextResponse.redirect(`${origin}${next}`);
    } catch {
      // Base injoignable : même issue qu'un lien expiré.
    }
  }
  return NextResponse.redirect(`${origin}/mot-de-passe-oublie?lien=expire`);
}
