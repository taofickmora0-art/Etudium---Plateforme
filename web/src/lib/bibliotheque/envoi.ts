import { racineSupabase } from "@/lib/couvertures/adresse";
import { getPublicEnv, type PublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";
import { PDF_TROP_LOURD } from "./regles";

// L'envoi d'un fichier du navigateur directement dans un espace de Supabase (comme les ressources), avec la progression :
// le PDF d'un livre peut peser 50 Mo, trop pour une action serveur, et long à envoyer sur une connexion mobile. La
// bibliothèque de Supabase ne donne pas la progression : l'envoi passe par XMLHttpRequest, vers la même adresse qu'elle
// (POST /storage/v1/object/<espace>/<chemin>), avec la session du compte. Les règles de l'espace décident (0074).

export type EnvoiFichier = {
  espace: string;
  chemin: string;
  fichier: Blob;
  /** Le type vérifié (le navigateur peut en annoncer un autre). */
  type: string;
  /** Durée de garde dans les caches, en secondes (une couverture ne change jamais : un an). */
  cacheSecondes?: number;
  /** 0 à 100, au fil de l'envoi. */
  onProgression?: (pourcentage: number) => void;
};

export type ResultatEnvoi = { ok: true } | { ok: false; message: string };

const COUPURE = "La connexion a été coupée pendant l’envoi. Réessayez.";
const REFUSE = "L’envoi a été refusé. Reconnectez-vous, puis réessayez.";
const ECHEC = "L’envoi n’a pas abouti. Réessayez.";

type Dependances = { xhr: () => XMLHttpRequest; env: () => PublicEnv; jeton: () => Promise<string | null> };

const jetonDeSession = async () => (await createClient().auth.getSession()).data.session?.access_token ?? null;
const PAR_DEFAUT: Dependances = { xhr: () => new XMLHttpRequest(), env: getPublicEnv, jeton: jetonDeSession };

function messageDuStatut(status: number, reponse: string): string {
  // L'espace refuse un fichier trop lourd par 413, ou par 400 avec « Payload too large ».
  if (status === 413 || /too large|exceeded the maximum/i.test(reponse)) return PDF_TROP_LOURD;
  if (status === 401 || status === 403) return REFUSE;
  return ECHEC;
}

export async function envoyerFichier(envoi: EnvoiFichier, dependances: Partial<Dependances> = {}): Promise<ResultatEnvoi> {
  const d = { ...PAR_DEFAUT, ...dependances };
  let jeton: string | null;
  let env: PublicEnv;
  try {
    [jeton, env] = [await d.jeton(), d.env()];
  } catch {
    return { ok: false, message: ECHEC };
  }
  if (!jeton) return { ok: false, message: REFUSE };
  const chemin = envoi.chemin.split("/").map(encodeURIComponent).join("/");
  const adresse = `${racineSupabase(env.supabaseUrl)}/storage/v1/object/${encodeURIComponent(envoi.espace)}/${chemin}`;
  return new Promise<ResultatEnvoi>((resoudre) => {
    const xhr = d.xhr();
    xhr.open("POST", adresse);
    xhr.setRequestHeader("authorization", `Bearer ${jeton}`);
    xhr.setRequestHeader("apikey", env.supabaseKey);
    xhr.setRequestHeader("content-type", envoi.type);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", `max-age=${envoi.cacheSecondes ?? 3600}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) envoi.onProgression?.(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () =>
      resoudre(xhr.status >= 200 && xhr.status < 300 ? { ok: true } : { ok: false, message: messageDuStatut(xhr.status, String(xhr.responseText ?? "")) });
    xhr.onerror = () => resoudre({ ok: false, message: COUPURE });
    xhr.send(envoi.fichier);
  });
}

/** Retire des fichiers déposés quand leur enregistrement a échoué (pas de fichier sans livre). Un échec est sans effet. */
export async function retirerDeposes(deposes: { espace: string; chemin: string }[]) {
  for (const { espace, chemin } of deposes) {
    try {
      await createClient().storage.from(espace).remove([chemin]);
    } catch {
      // Un fichier orphelin ne gêne rien : il ne sera jamais lu.
    }
  }
}
