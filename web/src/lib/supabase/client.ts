import { createBrowserClient } from "@supabase/ssr";
import { optionsCookiesSupabase } from "@/lib/auth/session-cookies";
import { getPublicEnv } from "@/lib/env";

/** Client Supabase pour les composants exécutés dans le navigateur. */
export function createClient() {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  // Les cookies de session écrits par le navigateur : `secure` en production, comme ceux du serveur.
  return createBrowserClient(supabaseUrl, supabaseKey, { cookieOptions: optionsCookiesSupabase() });
}
