"use server";

import { refresh } from "next/cache";
import { exigerEquipe, SESSION_EXPIREE } from "@/lib/admin/garde";
import { demoModeActive, getShellUser } from "@/lib/auth/current-user";
import { viderFileApres } from "@/lib/envois/declencher";
import { createClient } from "@/lib/supabase/server";
import { lireNotifications } from "./data";
import { ANNONCE_TEXTE_MAX, ANNONCE_TITRE_MAX, lienDuSite, NOMBRE_CLOCHE, NOMBRE_PAGE, REFUS_ANNONCE } from "./regles";
import type { LotNotifications } from "./types";

// Actions du centre de notifications (spec des notifications, §3). La base revérifie tout (migration 0016) : chacun ne
// lit et ne marque que les siennes ; seule l'équipe envoie une annonce.

const typographie = (message: string) => message.replace(/'/g, "’");

/** La cloche : les 8 dernières et le nombre de non lues ; null sans session, avant la 0016 ou si la base ne répond pas. */
export async function chargerCloche(): Promise<LotNotifications | null> {
  if (!(await getShellUser())) return null;
  // Les rappels des sessions live (migration 0018) sont créés quand la cloche se charge ; sans elle, rien n'est perdu.
  if (!demoModeActive()) {
    try {
      await (await createClient()).rpc("rappels_sessions");
    } catch {
      // Ignoré : la cloche lit ce qu'elle a.
    }
    // Les push et les e-mails en attente (migration 0058) partent après la réponse.
    viderFileApres();
  }
  try {
    const lecture = await lireNotifications({ nombre: NOMBRE_CLOCHE });
    return lecture.migrationAbsente ? null : lecture.donnees;
  } catch (erreur) {
    // La cloche ne doit jamais casser l'en-tête : l'incident est consigné, le panneau reste vide.
    console.error("Lecture des notifications impossible :", erreur instanceof Error ? erreur.message : erreur);
    return null;
  }
}

/** La page Notifications : 20 à la fois (toutes ou non lues), à partir de la dernière déjà affichée. */
export async function chargerNotifications(nonLues: boolean, avant: string | null): Promise<{ ok: true; page: LotNotifications } | { ok: false; message: string }> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  try {
    const lecture = await lireNotifications({ nonLues, avant, nombre: NOMBRE_PAGE });
    if (!lecture.migrationAbsente) return { ok: true, page: lecture.donnees };
  } catch {
    // Message ci-dessous.
  }
  return { ok: false, message: "Les notifications n’ont pas pu être chargées. Réessayez." };
}

/** Marque lues ces notifications, ou toutes (null). */
export async function marquerLues(ids: string[] | null): Promise<{ ok: boolean; message?: string }> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  const valables = ids === null ? null : ids.filter((id) => /^\d+$/.test(id)).map(Number);
  if (valables !== null && valables.length === 0) return { ok: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc("marquer_lues", { p_ids: valables });
  if (error) return { ok: false, message: "Les notifications n’ont pas pu être marquées comme lues. Réessayez." };
  return { ok: true };
}

/** Envoie une annonce à tous les comptes (l'équipe) ; rend le nombre de comptes qui la reçoivent. */
export async function publierAnnonce(titre: string, texte: string, lien: string): Promise<{ ok: true; destinataires: number } | { ok: false; message: string }> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const [t, x, l] = [(titre ?? "").trim(), (texte ?? "").trim(), (lien ?? "").trim()];
  if (t.length === 0 || t.length > ANNONCE_TITRE_MAX) return { ok: false, message: REFUS_ANNONCE.titre };
  if (x.length === 0 || x.length > ANNONCE_TEXTE_MAX) return { ok: false, message: REFUS_ANNONCE.texte };
  if (l && !lienDuSite(l)) return { ok: false, message: REFUS_ANNONCE.lien };
  const { data, error } = await garde.supabase.rpc("publier_annonce", { p_titre: t, p_texte: x, p_lien: l || null });
  if (error) {
    return { ok: false, message: error.code === "P0001" && error.message ? typographie(error.message) : "L’annonce n’a pas pu être envoyée. Réessayez." };
  }
  refresh();
  viderFileApres();
  return { ok: true, destinataires: Number(data) || 0 };
}
