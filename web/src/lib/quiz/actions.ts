"use server";

import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { INDISPONIBLE } from "@/lib/indisponible";
import { createClient } from "@/lib/supabase/server";
import { versResultat } from "./conversion";
import type { ReponsesQuiz, ResultatQuiz } from "./types";

// Envoyer un quiz (migration 0031) : la base vérifie l'accès, corrige, enregistre la tentative et rend le détail.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "Le quiz n’a pas pu être envoyé. Réessayez.";
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";

export async function envoyerQuiz(leconId: string, reponses: ReponsesQuiz): Promise<{ ok: true; resultat: ResultatQuiz } | { ok: false; message: string }> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(leconId)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("envoyer_quiz", { p_lecon: leconId, p_reponses: reponses ?? {} });
  if (error) {
    if (estFonctionAbsente(error)) return { ok: false, message: INDISPONIBLE };
    if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
    return { ok: false, message: ECHEC };
  }
  return { ok: true, resultat: versResultat(data) };
}
