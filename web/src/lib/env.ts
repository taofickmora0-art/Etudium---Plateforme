export type PublicEnvVariable = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | "NEXT_PUBLIC_SITE_URL";

export type PublicEnv = { supabaseUrl: string; supabaseKey: string };

export class EnvError extends Error {
  constructor(
    public readonly variable: PublicEnvVariable,
    message: string,
  ) {
    super(message);
    this.name = "EnvError";
  }
}

const MESSAGES = {
  urlVide: "NEXT_PUBLIC_SUPABASE_URL est vide : collez l’URL du projet Supabase dans web/.env.local.",
  urlSansHttps: "NEXT_PUBLIC_SUPABASE_URL doit commencer par https:// (exemple : https://abcd.supabase.co).",
  cleVide: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est vide : collez la clé publique du projet dans web/.env.local.",
  cleSecrete:
    "La clé collée dans NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY est une clé secrète. Remplacez-la par la clé publique (publishable ou anon) et ne la partagez avec personne.",
  cleInconnue:
    "La valeur de NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY n’est pas une clé publique Supabase : copiez la clé « publishable » (sb_publishable_…) ou l’ancienne clé « anon » depuis Project Settings › API.",
  siteVide:
    "NEXT_PUBLIC_SITE_URL est vide : le site en production a besoin de son adresse (exemple : https://etudium.online) pour les liens des e-mails, des certificats et le plan du site. Ajoutez-la dans Vercel › Settings › Environment Variables (environnement Production), puis redéployez.",
  siteSansHttps:
    "NEXT_PUBLIC_SITE_URL doit être une adresse complète qui commence par https:// (exemple : https://etudium.online). Corrigez-la dans Vercel › Settings › Environment Variables (environnement Production), puis redéployez.",
} as const;

/** Retire espaces, guillemets (droits ou typographiques) et préfixe « Bearer » ajoutés par erreur autour d'une clé. */
function cleanKey(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s]+$/g, "")
    .replace(/^Bearer\s+/i, "")
    .trim();
}

/** Rôle porté par une ancienne clé Supabase au format JWT, ou null si la clé n'en est pas une. */
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

function isSecretKey(key: string): boolean {
  return key.includes("sb_secret_") || jwtRole(key) === "service_role";
}

function isPublicKey(key: string): boolean {
  return key.startsWith("sb_publishable_") || jwtRole(key) === "anon";
}

export function readPublicEnv(source: Record<string, string | undefined>): PublicEnv {
  const url = (source.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  const key = cleanKey(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  if (!url) throw new EnvError("NEXT_PUBLIC_SUPABASE_URL", MESSAGES.urlVide);
  if (!url.startsWith("https://")) throw new EnvError("NEXT_PUBLIC_SUPABASE_URL", MESSAGES.urlSansHttps);
  if (!key) throw new EnvError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", MESSAGES.cleVide);
  if (isSecretKey(key)) throw new EnvError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", MESSAGES.cleSecrete);
  if (!isPublicKey(key)) throw new EnvError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", MESSAGES.cleInconnue);

  return { supabaseUrl: url, supabaseKey: key };
}

/**
 * Appelé au démarrage de Next (next.config.ts) : une variable NEXT_PUBLIC_ est recopiée dans le code envoyé
 * au navigateur, donc une clé secrète doit bloquer le démarrage. Une clé absente ne bloque pas.
 */
export function assertNoSecretKey(source: Record<string, string | undefined>): void {
  const key = cleanKey(source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  if (key && isSecretKey(key)) throw new EnvError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", MESSAGES.cleSecrete);
}

/**
 * Appelé au démarrage de Next (next.config.ts) : le build de production Vercel (VERCEL_ENV=production) exige l'adresse
 * du site, en https://. En local et en prévisualisation, rien n'est exigé (repli sur http://localhost:3000).
 */
export function assertSiteUrlEnProduction(source: Record<string, string | undefined>): void {
  if (source.VERCEL_ENV !== "production") return;
  const url = (source.NEXT_PUBLIC_SITE_URL ?? "").trim();
  if (!url) throw new EnvError("NEXT_PUBLIC_SITE_URL", MESSAGES.siteVide);
  let lisible = true;
  try {
    lisible = Boolean(new URL(url).hostname);
  } catch {
    lisible = false;
  }
  if (!url.startsWith("https://") || !lisible) throw new EnvError("NEXT_PUBLIC_SITE_URL", MESSAGES.siteSansHttps);
}

/** Lit la configuration publique. Les deux variables sont écrites en toutes lettres pour que Next les injecte côté navigateur. */
export function getPublicEnv(): PublicEnv {
  return readPublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
