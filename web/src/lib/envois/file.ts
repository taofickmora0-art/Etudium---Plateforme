import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { configurationEnvois, type ConfigEnvois } from "./config";
import { modeleEmail, type LigneDetail } from "./email";
import { envoyerEmail as envoyerEmailResend } from "./resend";
import { envoyerPush as envoyerPushWeb, type AppareilPush } from "./push";

// Vider la file d'envoi (migration 0058) : le serveur prend les envois prêts (réservés 2 minutes) avec son jeton, tiré
// de sa clé Resend ou VAPID (config.ts) et reconnu par la base une fois « Activer les envois » cliqué (0071). Il les
// envoie un par un (Resend limite le débit), puis termine chacun avec l'identifiant de sa prise. Seuls les canaux dont
// les clés existent sont pris. Chaque envoi dure 10 secondes au plus ; après 90 secondes, plus rien ne part (le reste
// est repris quand sa réservation expire) : un envoi n'est jamais terminé hors de sa réservation.
// Appelé après la réponse (after()) : ne lève jamais d'exception, et n'utilise pas les cookies de la requête.

type EnvoiPris = {
  id: number;
  prise: string;
  cree_le: string;
  canal: "push" | "email";
  titre: string;
  texte: string;
  lien: string | null;
  /** Les lignes de détail d'un e-mail (0073) ; absentes avant la migration. */
  details?: unknown;
  email: string | null;
  prenom: string | null;
  appareils: AppareilPush[] | null;
};

/** Les lignes de détail lisibles (libellé et valeur en texte) ; les autres sont ignorées. */
function lignesDetail(v: unknown): LigneDetail[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((l) => {
    const o = l && typeof l === "object" ? (l as Record<string, unknown>) : null;
    return o && typeof o.libelle === "string" && typeof o.valeur === "string" ? [{ libelle: o.libelle, valeur: o.valeur }] : [];
  });
}

export type DepsFile = {
  client?: SupabaseClient;
  config?: ConfigEnvois | null;
  envoyerEmail?: typeof envoyerEmailResend;
  envoyerPush?: typeof envoyerPushWeb;
  maintenant?: () => number;
};

const LIMITE = 10;
const DUREE_MAX_MS = 90_000;
const RIEN = { envoyes: 0, echecs: 0 };

/** Un client sans session : les fonctions de la file sont protégées par le jeton, pas par le compte connecté. */
function clientEnvois(): SupabaseClient {
  const { supabaseUrl, supabaseKey } = getPublicEnv();
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function viderFile(deps: DepsFile = {}): Promise<{ envoyes: number; echecs: number }> {
  const config = deps.config === undefined ? configurationEnvois() : deps.config;
  if (!config) return RIEN;
  const canaux = [...(config.push ? ["push"] : []), ...(config.email ? ["email"] : [])];
  if (canaux.length === 0) return RIEN;
  const envoyerEmail = deps.envoyerEmail ?? envoyerEmailResend;
  const envoyerPush = deps.envoyerPush ?? envoyerPushWeb;
  const maintenant = deps.maintenant ?? Date.now;
  const debut = maintenant();
  const bilan = { envoyes: 0, echecs: 0 };
  try {
    const client = deps.client ?? clientEnvois();
    const { data, error } = await client.rpc("prendre_envois", { p_jeton: config.jeton, p_canaux: canaux, p_limite: LIMITE });
    if (error) {
      console.warn(`[envois] file non prise (${error.code ?? "?"}) : ${error.message}`);
      return RIEN;
    }
    for (const e of (data ?? []) as EnvoiPris[]) {
      if (maintenant() - debut > DUREE_MAX_MS) break;
      let resultat: { ok: boolean; erreur?: string; disparus?: string[] };
      if (e.canal === "email") {
        if (!config.email || !e.email) resultat = { ok: false, erreur: "Pas d’adresse e-mail ou pas de clé Resend." };
        else {
          const m = modeleEmail({ titre: e.titre, texte: e.texte, lien: e.lien, prenom: e.prenom, details: lignesDetail(e.details) }, config.site);
          // Propre à cette base : le numéro seul se répète d'une base à l'autre (essai, production).
          resultat = await envoyerEmail(config.email, { a: e.email, ...m, idempotence: `envoi-${e.id}-${Date.parse(e.cree_le)}` });
        }
      } else if (!config.push) resultat = { ok: false, erreur: "Pas de clés VAPID." };
      else resultat = await envoyerPush(config.push, e.appareils ?? [], { titre: e.titre, texte: e.texte, lien: e.lien ?? "/accueil" });

      if (resultat.ok) bilan.envoyes++;
      else bilan.echecs++;
      const fin = await client.rpc("terminer_envoi", {
        p_jeton: config.jeton,
        p_id: e.id,
        p_prise: e.prise,
        p_reussi: resultat.ok,
        p_erreur: resultat.ok ? null : (resultat.erreur ?? "Échec").slice(0, 500),
        p_disparus: resultat.disparus ?? [],
      });
      if (fin.error) console.warn(`[envois] envoi ${e.id} non terminé : ${fin.error.message}`);
    }
  } catch (e) {
    console.warn(`[envois] ${e instanceof Error ? e.message : String(e)}`);
  }
  return bilan;
}
