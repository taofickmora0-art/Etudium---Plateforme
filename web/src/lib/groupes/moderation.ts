import { after } from "next/server";
import { formatDe } from "@/lib/admin/fichiers";
import { analyserPublication, configurationModeration } from "@/lib/moderation/analyse";
import type { ContenuAnalyse, Verdict } from "@/lib/moderation/types";
import type { createClient } from "@/lib/supabase/server";

// L'analyse automatique d'un message de groupe (spec des groupes, §4 ; migration 0075). Le message paraît tout de suite :
// l'analyse part après la réponse (after), avec le même mécanisme que les publications (analyserPublication, Claude
// Haiku, analyse.ts), puis la base reçoit le verdict avec le jeton de modération (verdict_message_groupe), comme publier
// le reçoit en 0020. Serveur seulement (sharp, la clé de l'IA).
//
// Sans configuration (clé ou jeton absents) ou sans requête en cours, rien ne part : le message reste « analyse
// attendue », et l'équipe le voit dans « À examiner » au bout de 5 minutes (file_moderation).

type Client = Awaited<ReturnType<typeof createClient>>;

/** Ce qu'il faut savoir du message à analyser. */
export type MessageAAnalyser = { id: string; texte: string; image: { chemin: string; type: string } | null; version: number; groupe: string };

const echec = (cause: string): Verdict => ({ decision: "echec", categorie: "aucune", raison: `Analyse impossible : ${cause}.` });

/** L'image relue avec la session de l'auteur ; ses premiers octets doivent être ceux de son type. */
async function relireImage(supabase: Client, image: NonNullable<MessageAAnalyser["image"]>): Promise<ContenuAnalyse["fichier"] | null> {
  const { data, error } = await supabase.storage.from("groupes").download(image.chemin);
  if (error || !data) return null;
  const octets = new Uint8Array(await data.arrayBuffer());
  return formatDe(image.chemin, octets.slice(0, 16)) === image.type ? { type: image.type, octets } : null;
}

/** Analyse le message et transmet le verdict ; aucun verdict de l'IA (clé refusée, refus) : l'équipe l'examinera. */
export async function analyserMessage(supabase: Client, message: MessageAAnalyser, f: typeof fetch = fetch): Promise<void> {
  const config = configurationModeration();
  if (!config) return;
  let fichier: ContenuAnalyse["fichier"] = null;
  let verdict: Verdict | null = null;
  if (message.image) {
    fichier = await relireImage(supabase, message.image);
    if (!fichier) verdict = echec("image illisible");
  }
  verdict ??= (await analyserPublication({ titre: "", texte: message.texte, espace: `groupe de discussion « ${message.groupe} »`, fichier }, config, f)) ?? echec("aucun verdict");
  await supabase.rpc("verdict_message_groupe", { p_message: message.id, p_analyse: { jeton: config.jeton, ...verdict, version: message.version } });
}

/** Après la réponse : l'analyse du message, si la base l'attend. Hors d'une requête (tests, scripts), rien ne part. */
export function analyserApres(supabase: Client, message: MessageAAnalyser, attendue: boolean): void {
  if (!attendue || !configurationModeration()) return;
  try {
    after(() => analyserMessage(supabase, message).catch(() => undefined));
  } catch {
    // Pas de requête en cours.
  }
}
