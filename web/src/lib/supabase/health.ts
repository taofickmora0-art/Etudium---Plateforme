import type { PublicEnv } from "@/lib/env";

export type SupabaseStatus =
  | { ok: true }
  | { ok: false; reason: "cle" | "pause" | "restreint" | "injoignable" | "inconnu"; message: string };

const CLE_REFUSEE: SupabaseStatus = {
  ok: false,
  reason: "cle",
  message: "Supabase refuse la clé : vérifiez NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans web/.env.local.",
};

// Codes documentés par Supabase : 540 = projet en pause, 402 = projet restreint (quotas).
const EN_PAUSE: SupabaseStatus = {
  ok: false,
  reason: "pause",
  message: "Le projet Supabase est en pause : réactivez-le depuis son tableau de bord (bouton « Restore project »).",
};

const RESTREINT: SupabaseStatus = {
  ok: false,
  reason: "restreint",
  message: "Le projet Supabase est restreint (quota du plan gratuit dépassé ?) : consultez son tableau de bord.",
};

const INJOIGNABLE: SupabaseStatus = {
  ok: false,
  reason: "injoignable",
  message: "Supabase ne répond pas : vérifiez l’URL et votre connexion, ou réactivez le projet s’il est en pause.",
};

/** Vérifie que le projet Supabase répond et accepte la clé publique (service d'authentification). */
export async function checkSupabase(
  env: PublicEnv,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5000,
): Promise<SupabaseStatus> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${env.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: env.supabaseKey },
      cache: "no-store",
      signal: controller.signal,
    });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) return CLE_REFUSEE;
    if (response.status === 540) return EN_PAUSE;
    if (response.status === 402) return RESTREINT;
    return {
      ok: false,
      reason: "inconnu",
      message: `Supabase a répondu avec une erreur inattendue (code ${response.status}). Réessayez dans un instant.`,
    };
  } catch {
    return INJOIGNABLE;
  } finally {
    clearTimeout(timer);
  }
}
