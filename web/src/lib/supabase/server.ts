import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, rememberFromCookie, withRememberChoice } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

/**
 * Client Supabase pour les composants serveur, actions serveur et routes.
 * `remember` force la durée des cookies (« Se souvenir de moi » choisi à la connexion) ;
 * sinon, elle suit le cookie `etudium-souvenir`.
 */
export async function createClient(options: { remember?: boolean } = {}) {
  // Les cookies d'abord : pendant la compilation, Next met cette lecture en attente (la page sera rendue à la requête),
  // et une configuration absente ne fait pas échouer la compilation.
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  const remember = options.remember ?? rememberFromCookie(cookieStore.get(REMEMBER_COOKIE)?.value);

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          // « Se souvenir de moi » décide de la durée des cookies de session (30 jours ou fermeture du navigateur).
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, withRememberChoice(options, remember)));
        } catch {
          // Appelé depuis un composant serveur : les cookies ne peuvent pas y être écrits.
          // Le proxy (src/proxy.ts) se charge de rafraîchir la session.
        }
      },
    },
  });
}
