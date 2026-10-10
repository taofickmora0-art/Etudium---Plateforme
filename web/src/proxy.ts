import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSessionCookie, isDemoMode, routeFor } from "@/lib/auth/routing";
import { REMEMBER_COOKIE, rememberFromCookie, withRememberChoice } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

/**
 * Avant chaque page : rafraîchit la session Supabase (cookies), puis protège l'espace connecté
 * et oriente la racine (spec §4 et §7). La vérification réelle des droits reste faite par la base.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  let signedIn = false;

  let env;
  try {
    env = getPublicEnv();
  } catch {
    env = null;
  }
  if (isDemoMode({ configured: env !== null, nodeEnv: process.env.NODE_ENV })) return response;

  try {
    if (!env) throw new Error("Base non configurée");
    const { supabaseUrl, supabaseKey } = env;
    const remember = rememberFromCookie(request.cookies.get(REMEMBER_COOKIE)?.value);
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, withRememberChoice(options, remember)));
        },
      },
    });
    // getClaims vérifie le jeton sur place (clés de signature du projet) et le renouvelle s'il a expiré.
    const { data } = await supabase.auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    // Base pas encore configurée ou injoignable : on se comporte comme sans session.
    signedIn = false;
  }

  const hadSession = hasSessionCookie(request.cookies.getAll().map((c) => c.name));
  const { redirect } = routeFor({ pathname: request.nextUrl.pathname, signedIn, hadSession });
  if (!redirect) return response;

  const redirection = NextResponse.redirect(new URL(redirect, request.url));
  // Garder les cookies que Supabase vient d'écrire (session renouvelée ou effacée).
  response.cookies.getAll().forEach((cookie) => redirection.cookies.set(cookie));
  return redirection;
}

export const config = {
  // Tout sauf les fichiers de Next et les fichiers statiques (avec extension).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)"],
};
