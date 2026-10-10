import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnv } from "@/lib/env";

/** Client Supabase pour les composants exécutés dans le navigateur. */
export function createClient() {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  return createBrowserClient(supabaseUrl, supabaseKey);
}
