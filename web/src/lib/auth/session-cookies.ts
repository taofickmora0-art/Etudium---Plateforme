import type { CookieOptions } from "@supabase/ssr";

/** « Se souvenir de moi » : "1" (coché, valeur par défaut) ou "0". */
export const REMEMBER_COOKIE = "etudium-souvenir";
/** Adresse en attente de vérification par le code : jamais dans l'URL. */
export const PENDING_EMAIL_COOKIE = "etudium-verification";
export const PENDING_EMAIL_MAX_AGE = 30 * 60;

const TRENTE_JOURS = 30 * 24 * 60 * 60;

/**
 * Durée des cookies de session Supabase selon « Se souvenir de moi » (spec §7) :
 * coché, 30 jours ; décoché, cookie de session, effacé à la fermeture du navigateur.
 * Une suppression (`maxAge: 0`) reste une suppression.
 */
export function withRememberChoice(options: CookieOptions, remember: boolean): CookieOptions {
  if (options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return remember ? { ...rest, maxAge: TRENTE_JOURS } : rest;
}

/** Valeur lue dans le cookie : absent = se souvenir. */
export const rememberFromCookie = (value: string | undefined) => value !== "0";
