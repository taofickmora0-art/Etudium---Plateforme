"use server";

import { refresh } from "next/cache";
import { SESSION_EXPIREE } from "@/lib/admin/garde";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, liste, texte, un } from "@/lib/contenus/lecture";
import { viderFileApres } from "@/lib/envois/declencher";
import { INDISPONIBLE } from "@/lib/indisponible";
import { refusSignalement } from "@/lib/moderation/regles";
import { MOTIFS, type MotifSignalement } from "@/lib/moderation/types";
import { createClient } from "@/lib/supabase/server";
import { versGroupe, versMessage, versResume } from "./conversion";
import { avecImages, lirePage } from "./data";
import { analyserApres } from "./moderation";
import { TEXTE_MAX } from "./regles";
import { REACTIONS, type FilGroupe, type Groupe, type MessageGroupe, type ReactionMessage, type ResumeGroupe } from "./types";

// Écrire et relire dans un groupe (migration 0075) : la base vérifie le droit d'entrer, le texte, l'image et la cadence,
// et prévient l'auteur d'un message auquel on répond. Les relectures de l'écran (temps réel, secours toutes les 20 s)
// rendent null sur une erreur : l'écran garde ce qu'il montre.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const ENVOI_ECHEC = "Votre message n’a pas pu être envoyé. Réessayez.";
type Refus = { ok: false; message: string };
type Resultat = { ok: true } | Refus;
type Erreur = { code?: string; message?: string };

/** Le refus de la base (P0001, 42501) tel quel, la migration manquante (message neutre), ou le message d'échec. */
function refus(error: Erreur, echec = ECHEC): Refus {
  if (estFonctionAbsente(error)) return { ok: false, message: INDISPONIBLE };
  if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
  return { ok: false, message: echec };
}

async function session() {
  return (await getShellUser()) ? await createClient() : null;
}

/** Mes groupes (la liste, et le total des non-lus du menu) ; null avant la 0075 ou sur une erreur. */
export async function chargerMesGroupes(): Promise<{ ok: true; groupes: ResumeGroupe[] } | { ok: false; absente: boolean }> {
  const supabase = await session();
  if (!supabase) return { ok: false, absente: false };
  try {
    const { data, error } = await supabase.rpc("mes_groupes");
    if (error) return { ok: false, absente: estFonctionAbsente(error) };
    return { ok: true, groupes: liste(data).map(versResume) };
  } catch {
    return { ok: false, absente: false };
  }
}

/** Le groupe relu (en-tête : membres, épinglé, coupé) ; null sur une erreur. */
export async function relireGroupe(slug: string): Promise<Groupe | null> {
  const supabase = await session();
  if (!supabase || typeof slug !== "string") return null;
  try {
    const { data, error } = await supabase.rpc("groupe_par_slug", { p_slug: slug });
    if (error) return null;
    const groupe = versGroupe(data);
    if (groupe?.ouvert && groupe.epingle) groupe.epingle = (await avecImages(supabase, [groupe.epingle]))[0];
    return groupe;
  } catch {
    return null;
  }
}

/** Les derniers messages (temps réel, secours), ou ceux d'avant `avant` (« Charger les messages précédents ») ; null sur une erreur. */
export async function relireMessages(groupeId: string, avant?: string | null): Promise<FilGroupe | null> {
  if (!UUID.test(groupeId) || (avant && !UUID.test(avant))) return null;
  const supabase = await session();
  if (!supabase) return null;
  try {
    const page = await lirePage(supabase, groupeId, avant ?? null);
    return "fil" in page ? page.fil : null;
  } catch {
    return null;
  }
}

/** Le message rendu par la base, son image avec un lien, et ce qu'il faut pour l'analyse. */
async function messageRendu(supabase: Awaited<ReturnType<typeof createClient>>, data: unknown) {
  const brut = un(data);
  if (!brut) return null;
  const [message] = await avecImages(supabase, [versMessage(brut)]);
  return {
    message,
    analyse: {
      attendue: brut.analyser === true,
      cible: { id: message.id, texte: message.texte, image: message.image ? { chemin: message.image.chemin, type: message.image.type } : null, version: Number(brut.version) || 1, groupe: texte(brut.groupe_nom) },
    },
  };
}

/**
 * Envoie un message : un texte, une image déjà déposée dans le dossier du compte (espace « groupes »), ou les deux ; en
 * réponse à un message, éventuellement. Il paraît tout de suite ; l'analyse automatique, si elle est active, part après.
 */
export async function envoyerMessageGroupe(
  groupeId: string,
  texteMessage: string,
  image: string | null,
  reponseA: string | null,
): Promise<{ ok: true; message: MessageGroupe } | Refus> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(groupeId) || typeof texteMessage !== "string" || texteMessage.length > TEXTE_MAX + 200 || (reponseA !== null && !UUID.test(reponseA))) {
    return { ok: false, message: ENVOI_ECHEC };
  }
  if (image !== null && (typeof image !== "string" || !/^[0-9a-f-]{36}\/[0-9a-z-]+\.(jpg|jpeg|png|webp)$/i.test(image))) return { ok: false, message: ENVOI_ECHEC };
  const { data, error } = await supabase.rpc("envoyer_message_groupe", { p_groupe: groupeId, p_texte: texteMessage, p_image: image, p_reponse_a: reponseA });
  if (error) return refus(error, ENVOI_ECHEC);
  const rendu = await messageRendu(supabase, data);
  if (!rendu) return { ok: false, message: ENVOI_ECHEC };
  analyserApres(supabase, rendu.analyse.cible, rendu.analyse.attendue);
  // Une réponse prévient l'auteur cité (cloche, push).
  if (reponseA) viderFileApres();
  return { ok: true, message: rendu.message };
}

/** Modifier son message (15 minutes) ; analyse active, la nouvelle version est analysée à son tour. */
export async function modifierMessageGroupe(id: string, texteMessage: string): Promise<{ ok: true; message: MessageGroupe } | Refus> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id) || typeof texteMessage !== "string" || texteMessage.length > TEXTE_MAX + 200) return { ok: false, message: ECHEC };
  const { data, error } = await supabase.rpc("modifier_message_groupe", { p_message: id, p_texte: texteMessage });
  if (error) return refus(error);
  const rendu = await messageRendu(supabase, data);
  if (!rendu) return { ok: false, message: ECHEC };
  analyserApres(supabase, rendu.analyse.cible, rendu.analyse.attendue);
  return { ok: true, message: rendu.message };
}

/** Supprimer un message (son auteur, le formateur ou l'équipe du groupe) ; son image est effacée du stockage. */
export async function supprimerMessageGroupe(id: string): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const { data, error } = await supabase.rpc("supprimer_message_groupe", { p_message: id });
  if (error) return refus(error);
  if (typeof data === "string" && data) await supabase.storage.from("groupes").remove([data]).catch(() => undefined);
  return { ok: true };
}

/** Mettre ou enlever une réaction (l'un des six emojis). */
export async function reagirMessageGroupe(id: string, emoji: string): Promise<{ ok: true; reactions: ReactionMessage[] } | Refus> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id) || !(REACTIONS as readonly string[]).includes(emoji)) return { ok: false, message: ECHEC };
  const { data, error } = await supabase.rpc("reagir_message_groupe", { p_message: id, p_emoji: emoji });
  if (error) return refus(error);
  return { ok: true, reactions: liste(un(data)?.reactions).map((r) => ({ emoji: texte(r.emoji), nombre: Number(r.nombre) || 0, moi: r.moi === true })) };
}

/** Épingler (il remplace le précédent) ou désépingler : le formateur et l'équipe. */
export async function epinglerMessageGroupe(id: string, epingle: boolean): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id)) return { ok: false, message: ECHEC };
  const { error } = await supabase.rpc("epingler_message_groupe", { p_message: id, p_epingle: epingle === true });
  if (error) return refus(error);
  return { ok: true };
}

/** Lu jusqu'à ce message ; rend les non-lus qui restent dans le groupe. */
export async function marquerGroupeLu(groupeId: string, messageId: string): Promise<{ ok: true; nonLus: number } | Refus> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(groupeId) || !UUID.test(messageId)) return { ok: false, message: ECHEC };
  const { data, error } = await supabase.rpc("marquer_groupe_lu", { p_groupe: groupeId, p_message: messageId });
  if (error) return refus(error);
  return { ok: true, nonLus: Number(data) || 0 };
}

/** « Couper les notifications » du groupe, ou les rétablir. */
export async function couperGroupe(groupeId: string, coupe: boolean): Promise<{ ok: true; coupe: boolean } | Refus> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(groupeId)) return { ok: false, message: ECHEC };
  const { data, error } = await supabase.rpc("couper_groupe", { p_groupe: groupeId, p_coupe: coupe === true });
  if (error) return refus(error);
  return { ok: true, coupe: data === true };
}

/** Signaler un message à l'équipe ; son auteur ne sait jamais qui l'a signalé. */
export async function signalerMessageGroupe(id: string, motif: MotifSignalement, precisions: string): Promise<Resultat> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(id) || !MOTIFS.includes(motif) || typeof precisions !== "string") return { ok: false, message: ECHEC };
  const refusMotif = refusSignalement(motif, precisions);
  if (refusMotif) return { ok: false, message: refusMotif };
  const { error } = await supabase.rpc("signaler_message_groupe", { p_message: id, p_motif: motif, p_precisions: precisions.trim() });
  if (error) return refus(error);
  viderFileApres();
  return { ok: true };
}

/** Activer ou désactiver le groupe d'une formation : son formateur et l'équipe des contenus. Tout de suite, sans brouillon. */
export async function activerGroupeFormation(formationId: string, actif: boolean): Promise<{ ok: true; actif: boolean; slug: string | null } | Refus> {
  const supabase = await session();
  if (!supabase) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(formationId)) return { ok: false, message: ECHEC };
  const { data, error } = await supabase.rpc("activer_groupe_formation", { p_formation: formationId, p_actif: actif === true });
  if (error) return refus(error);
  const etat = un(data);
  refresh();
  return { ok: true, actif: etat?.actif === true, slug: texte(etat?.slug) || null };
}
