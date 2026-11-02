import type { CookieOptions } from "@supabase/ssr";

/** « Se souvenir de moi » : "1" (coché, valeur par défaut) ou "0". */
export const REMEMBER_COOKIE = "etudium-souvenir";
/** Adresse en attente de vérification par le code : jamais dans l'URL. */
export const PENDING_EMAIL_COOKIE = "etudium-verification";
export const PENDING_EMAIL_MAX_AGE = 30 * 60;
/** La page demandée avant l'inscription par e-mail (« Choisir Standard ») : retrouvée après le code. */
export const SUITE_COOKIE = "etudium-suite";

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

/**
 * Les options ajoutées aux cookies de session Supabase (`cookieOptions` de @supabase/ssr, fusionnées avec les siennes :
 * path « / », sameSite « lax ») : `secure` en production, où le site est servi en https ; rien en développement, où
 * http://localhost et l'adresse du Wi-Fi (téléphone) doivent garder la session. La durée reste celle de
 * `withRememberChoice`. `nodeEnv` est lu en toutes lettres par défaut : Next l'injecte aussi côté navigateur.
 */
export function optionsCookiesSupabase(nodeEnv: string | undefined = process.env.NODE_ENV): CookieOptions {
  return nodeEnv === "production" ? { secure: true } : {};
}

/** Valeur lue dans le cookie : absent = se souvenir. */
export const rememberFromCookie = (value: string | undefined) => value !== "0";
