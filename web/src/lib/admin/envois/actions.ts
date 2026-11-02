"use server";

import { refresh } from "next/cache";
import { exigerDomaine } from "@/lib/admin/garde";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { jetonEnvois } from "@/lib/envois/config";
import { MIGRATION_ENVOIS, SANS_CLE_ENVOIS } from "./types";

// « Activer les envois » (mise en ligne, migration 0071), comme « Activer les paiements » : la base garde l'empreinte
// du jeton du serveur, tiré de la clé Resend (à défaut, de la clé privée VAPID). Administrateurs seulement ; la base
// revérifie le rôle et le compte actif.

type Resultat = { ok: true } | { ok: false; message: string };

const ECHEC = "L’opération n’a pas abouti. Réessayez.";

export async function activerEnvois(): Promise<Resultat> {
  const garde = await exigerDomaine("paiements");
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const jeton = jetonEnvois();
  if (!jeton) return { ok: false, message: SANS_CLE_ENVOIS };
  const { error } = await garde.supabase.rpc("enregistrer_jeton_envois", { p_jeton: jeton });
  if (error) {
    if (estFonctionAbsente(error)) return { ok: false, message: MIGRATION_ENVOIS };
    if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
    return { ok: false, message: ECHEC };
  }
  refresh();
  return { ok: true };
}
