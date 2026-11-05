import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { optionsCookiesSupabase, REMEMBER_COOKIE, rememberFromCookie, withRememberChoice } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

/**
 * Client Supabase pour les composants serveur, actions serveur et routes.
 * `remember` force la durée des cookies (« Se souvenir de moi » choisi à la connexion) ;
 * sinon, elle suit le cookie `etudium-souvenir`. `entetes` : des en-têtes de plus pour chaque requête à la base (le
 * jeton de déverrouillage de « Mes résultats », lu par ses règles d'accès).
 */
export async function createClient(options: { remember?: boolean; entetes?: Record<string, string> } = {}) {
  // Les cookies d'abord : pendant la compilation, Next met cette lecture en attente (la page sera rendue à la requête),
  // et une configuration absente ne fait pas échouer la compilation.
  const cookieStore = await cookies();
  // Le client lit l'heure dès sa création (expiration du jeton) : il ne naît qu'à une vraie requête, jamais pendant le
  // pré-rendu (Cache Components le refuse : « Date.now() while prerendering »).
  await connection();
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  const remember = options.remember ?? rememberFromCookie(cookieStore.get(REMEMBER_COOKIE)?.value);

  return createServerClient(supabaseUrl, supabaseKey, {
    ...(options.entetes ? { global: { headers: options.entetes } } : {}),
    // `secure` en production (https seulement).
    cookieOptions: optionsCookiesSupabase(),
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
