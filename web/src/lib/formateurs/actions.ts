"use server";

import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, texte } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { MIGRATION_FORMATEURS } from "./conversion";

// « Message » sur la fiche d'une formation ou le profil d'un formateur (migration 0070) : la base trouve le compte relié
// à la fiche et vérifie le droit d'écrire (inscription à une de ses formations, compte formateur), puis ouvre ou
// retrouve la conversation. L'appli ne connaît jamais le compte relié.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const OUVERTURE_ECHEC = "La conversation n’a pas pu s’ouvrir. Réessayez.";

/** Ouvre (ou retrouve) la conversation avec le formateur de cette fiche ; mène ensuite à /messages?c=<conversationId>. */
export async function ecrireAuFormateur(formateurId: string): Promise<{ ok: true; conversationId: string } | { ok: false; message: string }> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (typeof formateurId !== "string" || !UUID.test(formateurId)) return { ok: false, message: OUVERTURE_ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("ouvrir_conversation_formateur", { p_formateur: formateurId });
  if (error) {
    if (estFonctionAbsente(error)) return { ok: false, message: MIGRATION_FORMATEURS };
    // Le refus de la base (P0001, 42501) est écrit pour l'étudiant.
    if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
    return { ok: false, message: OUVERTURE_ECHEC };
  }
  const id = texte(data);
  return UUID.test(id) ? { ok: true, conversationId: id } : { ok: false, message: OUVERTURE_ECHEC };
}
