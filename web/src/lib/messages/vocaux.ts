import type { createClient } from "@/lib/supabase/server";
import type { Fil, Message } from "./types";

// Les liens d'écoute des notes vocales d'un fil (migration 0076), signés une heure en un seul appel, côté serveur :
// la bulle joue dès l'appui (Safari, sur iPhone, refuse de jouer un son dont le lien arrive après un échange réseau).

type Client = Awaited<ReturnType<typeof createClient>>;

/** Les messages, leurs notes vocales munies d'un lien ; un lien manquant reste null (la bulle le demandera à l'appui). */
export async function avecNotesVocales(supabase: Client, messages: Message[]): Promise<Message[]> {
  const chemins = [...new Set(messages.flatMap((m) => (m.vocal?.chemin ? [m.vocal.chemin] : [])))];
  if (chemins.length === 0) return messages;
  const { data, error } = await supabase.storage.from("messages").createSignedUrls(chemins, 3600);
  const liens = new Map<string, string>();
  if (!error) for (const lien of data ?? []) if (lien.path && lien.signedUrl && !lien.error) liens.set(lien.path, lien.signedUrl);
  return messages.map((m) => (m.vocal ? { ...m, vocal: { ...m.vocal, url: liens.get(m.vocal.chemin) ?? null } } : m));
}

/** Le fil, ses notes vocales munies d'un lien. */
export async function filAvecNotesVocales(supabase: Client, fil: Fil | null): Promise<Fil | null> {
  return fil ? { ...fil, messages: await avecNotesVocales(supabase, fil.messages) } : null;
}
