"use server";

import { refresh } from "next/cache";
import { exigerEquipe } from "@/lib/admin/garde";
import { estFonctionAbsente, un } from "@/lib/contenus/lecture";
import { idYoutube } from "./liens";
import type { DonneesAnnonce } from "./types";

// Le réglage de l'annonce épinglée par l'équipe (spec du fil « Actualités », §2 ; migration 0021). La base revérifie le
// compte, le titre, la vidéo, l'affiche (type, taille, dossier du compte) et le parcours ; ses messages (P0001) sont
// faits pour être affichés tels quels. L'affiche remplacée ou retirée est ôtée du stockage.

const MIGRATION = "Appliquez la migration 0021 (guide « Ce qui te revient », section 26).";
const ECHEC = "L’opération n’a pas abouti. Réessayez.";
const YOUTUBE_INCONNU = "Cette adresse YouTube n’est pas reconnue.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Erreur = { code?: string; message?: string };
type Resultat = { ok: true } | { ok: false; message: string };

function message(error: Erreur): string {
  if (estFonctionAbsente(error)) return MIGRATION;
  if ((error.code === "P0001" || error.code === "42501") && error.message) return error.message.replace(/'/g, "’");
  return ECHEC;
}

/** Enregistrer l'annonce : la vidéo par son adresse YouTube, l'affiche déjà déposée par le navigateur. */
export async function enregistrerAnnonce(d: DonneesAnnonce): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const type = d.media === "youtube" || d.media === "image" ? d.media : null;
  const youtubeId = type === "youtube" ? idYoutube(d.youtube.trim()) : null;
  if (type === "youtube" && !youtubeId) return { ok: false, message: YOUTUBE_INCONNU };
  const affiche = type === "image" ? d.imageChemin : null;
  const { supabase } = garde;
  const avant = await supabase.rpc("annonce_equipe");
  const ancienne = avant.error ? null : (un(avant.data)?.image_chemin ?? null);
  const { error } = await supabase.rpc("enregistrer_annonce", {
    p_active: d.active,
    p_titre: d.titre.trim(),
    p_texte: d.texte.trim(),
    p_media: type,
    p_youtube_id: youtubeId,
    p_image_chemin: affiche,
    p_public: d.public === "parcours" ? "parcours" : "tous",
    p_parcours: d.public === "parcours" && d.parcoursId && UUID.test(d.parcoursId) ? d.parcoursId : null,
  });
  if (error) {
    // L'affiche tout juste déposée n'est attachée à rien.
    if (affiche && affiche !== ancienne) await supabase.storage.from("communaute").remove([affiche]);
    return { ok: false, message: message(error) };
  }
  if (typeof ancienne === "string" && ancienne && ancienne !== affiche) await supabase.storage.from("communaute").remove([ancienne]);
  refresh();
  return { ok: true };
}

/** Retirer l'annonce : inactive et vidée ; son affiche est ôtée du stockage. */
export async function retirerAnnonce(): Promise<Resultat> {
  const garde = await exigerEquipe();
  if ("erreur" in garde) return { ok: false, message: garde.erreur };
  const { data, error } = await garde.supabase.rpc("retirer_annonce");
  if (error) return { ok: false, message: message(error) };
  if (typeof data === "string" && data) await garde.supabase.storage.from("communaute").remove([data]);
  refresh();
  return { ok: true };
}
