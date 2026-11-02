import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { EN_TETE_CHEMIN, hasSessionCookie, isDemoMode, routeFor } from "@/lib/auth/routing";
import { optionsCookiesSupabase, REMEMBER_COOKIE, rememberFromCookie, withRememberChoice } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

/**
 * Avant chaque page : rafraîchit la session Supabase (cookies), puis protège l'espace connecté
 * et oriente la racine (spec §4 et §7). La vérification réelle des droits reste faite par la base.
 */
export async function proxy(request: NextRequest) {
  // Transmis aux pages (remplace toute valeur envoyée par le navigateur) : une session fermée ailleurs y ramènera.
  request.headers.set(EN_TETE_CHEMIN, request.nextUrl.pathname);
  let response = NextResponse.next({ request });
  let signedIn = false;
  // En-têtes fournis par Supabase quand il écrit les cookies de session : interdisent toute mise en cache,
  // pour qu'une réponse portant le jeton d'une personne ne soit jamais resservie à une autre.
  let entetesSansCache: Record<string, string> = {};

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
      // `secure` en production (https seulement).
      cookieOptions: optionsCookiesSupabase(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, withRememberChoice(options, remember)));
          entetesSansCache = { ...entetesSansCache, ...headers };
          Object.entries(entetesSansCache).forEach(([nom, valeur]) => response.headers.set(nom, valeur));
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
  Object.entries(entetesSansCache).forEach(([nom, valeur]) => redirection.headers.set(nom, valeur));
  return redirection;
}

export const config = {
  // Tout sauf les fichiers de Next, ceux de pdf.js (public/pdfjs) et les vrais fichiers statiques : images, icônes,
  // manifeste et polices partout ;
  // scripts, styles, textes, XML et PDF seulement à la racine (robots.txt, sitemap.xml…).
  // Une page dont l'adresse contient un point (« /formations/python-3.12 », « /formations/node.js ») reste surveillée.
  matcher: ["/((?!_next/static|_next/image|pdfjs/|.*\\.(?:ico|png|jpe?g|gif|webp|avif|svg|webmanifest|woff2?|ttf)$|[^/]*\\.(?:css|js|map|txt|xml|pdf)$).*)"],
};
