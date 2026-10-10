import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

/** Client Supabase pour les composants serveur, actions serveur et routes. */
export async function createClient() {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Appelé depuis un composant serveur : les cookies ne peuvent pas y être écrits.
          // Le proxy (tâche 0.4) se charge de rafraîchir la session.
        }
      },
    },
  });
}
