import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/lib/env";
import { configurationEnvois, type ConfigEnvois } from "./config";
import { modeleEmail } from "./email";
import { envoyerEmail as envoyerEmailResend } from "./resend";
import { envoyerPush as envoyerPushWeb, type AppareilPush } from "./push";

// Vider la file d'envoi (migration 0058) : le serveur prend les envois prêts avec son jeton (réservés 2 minutes), les
// envoie un par un (Resend limite le débit), puis termine chacun. Seuls les canaux dont les clés existent sont pris.
// Appelé après la réponse (after()) : ne lève jamais d'exception, et n'utilise pas les cookies de la requête.

type EnvoiPris = {
  id: number;
  canal: "push" | "email";
  titre: string;
  texte: string;
  lien: string | null;
  email: string | null;
  prenom: string | null;
  appareils: AppareilPush[] | null;
};

export type DepsFile = {
  client?: SupabaseClient;
  config?: ConfigEnvois | null;
  envoyerEmail?: typeof envoyerEmailResend;
  envoyerPush?: typeof envoyerPushWeb;
};

const LIMITE = 20;
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
  const bilan = { envoyes: 0, echecs: 0 };
  try {
    const client = deps.client ?? clientEnvois();
    const { data, error } = await client.rpc("prendre_envois", { p_jeton: config.jeton, p_canaux: canaux, p_limite: LIMITE });
    if (error) {
      console.warn(`[envois] file non prise (${error.code ?? "?"}) : ${error.message}`);
      return RIEN;
    }
    for (const e of (data ?? []) as EnvoiPris[]) {
      let resultat: { ok: boolean; erreur?: string; disparus?: string[] };
      if (e.canal === "email") {
        if (!config.email || !e.email) resultat = { ok: false, erreur: "Pas d’adresse e-mail ou pas de clé Resend." };
        else {
          const m = modeleEmail({ titre: e.titre, texte: e.texte, lien: e.lien, prenom: e.prenom }, config.site);
          resultat = await envoyerEmail(config.email, { a: e.email, ...m, idempotence: `envoi-${e.id}` });
        }
      } else if (!config.push) resultat = { ok: false, erreur: "Pas de clés VAPID." };
      else resultat = await envoyerPush(config.push, e.appareils ?? [], { titre: e.titre, texte: e.texte, lien: e.lien ?? "/accueil" });

      if (resultat.ok) bilan.envoyes++;
      else bilan.echecs++;
      const fin = await client.rpc("terminer_envoi", {
        p_jeton: config.jeton,
        p_id: e.id,
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
