"use server";

import { refresh } from "next/cache";
import { getShellUser } from "@/lib/auth/current-user";
import { versReponse } from "@/lib/communaute/data";
import { refusReponse } from "@/lib/communaute/regles";
import type { Reponse } from "@/lib/communaute/types";
import { estFonctionAbsente, liste, un } from "@/lib/contenus/lecture";
import type { MotifSignalement } from "@/lib/moderation/types";
import { createClient } from "@/lib/supabase/server";

// Les discussions d'une leçon (refonte des formations, étape B, migration 0028) : les mêmes réponses que les actions des
// commentaires de la communauté, pour que le même écran serve aux deux. La base vérifie l'accès à la leçon.

type Refus = { ok: false; message: string };
type Resultat = { ok: true } | Refus;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const MIGRATION = "Appliquez la migration 0028 (guide « Ce qui te revient », section 34).";
const MOTIFS: MotifSignalement[] = ["inapproprie", "spam", "harcelement", "autre"];

type Erreur = { code?: string; message?: string };
function message(erreur: Erreur): string {
  if (estFonctionAbsente(erreur)) return MIGRATION;
  if ((erreur.code === "P0001" || erreur.code === "42501") && erreur.message) return erreur.message.replace(/'/g, "’");
  return ECHEC;
}

/** Tous les commentaires de la leçon (« Voir plus de commentaires »). */
export async function chargerDiscussion(leconId: string): Promise<{ ok: true; reponses: Reponse[] } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(leconId)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discussion_lecon", { p_lecon: leconId, p_tout: true });
  if (error) return { ok: false, message: message(error) };
  return { ok: true, reponses: liste(un(data)?.commentaires).map(versReponse) };
}

/** Commenter la leçon, ou répondre à un commentaire (un seul niveau : la base ramène au premier). */
export async function commenterLecon(leconId: string, texte: string, parentId: string | null = null): Promise<{ ok: true; reponse: Reponse } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(leconId) || (parentId !== null && !UUID.test(parentId))) return { ok: false, message: ECHEC };
  const refus = refusReponse(texte);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("commenter_lecon", { p_lecon: leconId, p_texte: texte.trim(), p_parent: parentId });
  if (error) return { ok: false, message: message(error) };
  const carte = un(data);
  if (!carte) return { ok: false, message: ECHEC };
  refresh();
  return { ok: true, reponse: versReponse(carte) };
}

/** Modifier son commentaire. */
export async function modifierCommentaireLecon(id: string, texte: string): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const refus = refusReponse(texte);
  if (refus) return { ok: false, message: refus };
  const supabase = await createClient();
  const { error } = await supabase.rpc("modifier_commentaire_lecon", { p_id: id, p_texte: texte.trim() });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true };
}

/** « J’aime » : ajoute ou retire, et rend l'état et le nombre. */
export async function aimerCommentaireLecon(id: string): Promise<{ ok: true; jAime: boolean; reactions: number } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("basculer_reaction_commentaire_lecon", { p_id: id });
  if (error) return { ok: false, message: message(error) };
  const r = un(data);
  return { ok: true, jAime: r?.j_aime === true, reactions: Number(r?.reactions) || 0 };
}

/** Son auteur, le formateur de la formation ou l'équipe ; rend le nombre retiré (lui et ses réponses). */
export async function supprimerCommentaireLecon(id: string): Promise<{ ok: true; supprimes: number } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("supprimer_commentaire_lecon", { p_id: id });
  if (error) return { ok: false, message: message(error) };
  refresh();
  return { ok: true, supprimes: typeof data === "number" && data > 0 ? data : 1 };
}

/** Signaler un commentaire : il entre dans la file de modération de l'équipe. */
export async function signalerCommentaireLecon(id: string, motif: MotifSignalement, precisions: string): Promise<Resultat> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id) || !MOTIFS.includes(motif)) return { ok: false, message: ECHEC };
  if (motif === "autre" && !precisions.trim()) return { ok: false, message: "Précisez le motif du signalement." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("signaler_commentaire_lecon", { p_id: id, p_motif: motif, p_precisions: precisions.trim() });
  if (error) return { ok: false, message: message(error) };
  return { ok: true };
}
