"use server";

import { SESSION_EXPIREE } from "@/lib/admin/garde";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente } from "@/lib/contenus/lecture";
import { INDISPONIBLE } from "@/lib/indisponible";
import { createClient } from "@/lib/supabase/server";
import { adresseDePush } from "./appareils";

// Les appareils du push (migration 0058) : chacun enregistre ou retire les siens ; la base revérifie le compte,
// l'adresse (un service de push, 1 000 caractères au plus) et la limite de 10 appareils.

export type AppareilNavigateur = { adresse: string; p256dh: string; auth: string };
type Resultat = { ok: true } | { ok: false; message: string };

const ECHEC = "Cet appareil n’a pas pu être enregistré. Réessayez.";

const cle = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 200;

export async function enregistrerAppareil(a: AppareilNavigateur): Promise<Resultat> {
  if (!adresseDePush(a?.adresse) || !cle(a.p256dh) || !cle(a.auth)) return { ok: false, message: ECHEC };
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const { error } = await (await createClient()).rpc("enregistrer_appareil", { p_adresse: a.adresse, p_p256dh: a.p256dh, p_auth: a.auth });
  if (error) return { ok: false, message: estFonctionAbsente(error) ? INDISPONIBLE : ECHEC };
  return { ok: true };
}

export async function retirerAppareil(adresse: string): Promise<Resultat> {
  if (!adresseDePush(adresse)) return { ok: true };
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const { error } = await (await createClient()).rpc("retirer_appareil", { p_adresse: adresse });
  if (error && !estFonctionAbsente(error)) return { ok: false, message: "Cet appareil n’a pas pu être retiré. Réessayez." };
  return { ok: true };
}
