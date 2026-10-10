import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, rememberFromCookie, withRememberChoice } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

/** Client Supabase pour les composants serveur, actions serveur et routes. */
export async function createClient() {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  const cookieStore = await cookies();
  const remember = rememberFromCookie(cookieStore.get(REMEMBER_COOKIE)?.value);

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
