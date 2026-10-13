"use server";

import { refresh } from "next/cache";
import { formatParMime } from "@/lib/admin/fichiers";
import { texte, type Ligne } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { LIEN_ECHEC, NOTE_ECHEC, NOTE_MAX } from "./regles";

// Actions de la page leçon. Les règles de la base décident de l'accès (notes : chacun les siennes, sur une leçon ouverte ;
// ressources : avec l'accès à la leçon) ; on revérifie la session ici, sans faire confiance au navigateur.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FICHIER_INACCESSIBLE = "Ce fichier n’est pas accessible.";

/** Enregistre la note privée d'une leçon ; une note vidée est effacée. */
export async function enregistrerNote(leconId: string, saisie: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const compte = error ? null : (data?.user ?? null);
  if (!compte) return { ok: false, erreur: "Connectez-vous pour enregistrer vos notes." };
  if (saisie.length > NOTE_MAX) return { ok: false, erreur: "Votre note dépasse 5 000 caractères." };
  if (!UUID.test(leconId)) return { ok: false, erreur: NOTE_ECHEC };

  const reponse =
    saisie.trim() === ""
      ? await supabase.from("notes_lecons").delete().eq("lecon_id", leconId).eq("profil_id", compte.id)
      : await supabase.from("notes_lecons").upsert({ profil_id: compte.id, lecon_id: leconId, texte: saisie }, { onConflict: "profil_id,lecon_id" });
  if (reponse.error) return { ok: false, erreur: NOTE_ECHEC };
  // La page est relue : un retour arrière ou l'autre jeu d'onglets ne montrent pas l'ancienne note.
  refresh();
  return { ok: true };
}

/** Nom proposé au téléchargement : le titre, avec l'extension du format (sans la doubler), sans barre oblique. */
function nomDeTelechargement(titre: string, format: string): string {
  const extension = formatParMime(format)?.extensions[0];
  const nom = titre.replace(/[/\\]/g, "-");
  return !extension || nom.toLowerCase().endsWith(`.${extension}`) ? nom : `${nom}.${extension}`;
}

/** Lien de téléchargement temporaire (60 s) d'une ressource téléchargeable de leçon ouverte. */
export async function lienRessource(ressourceId: string): Promise<{ url: string } | { erreur: string }> {
  if (!UUID.test(ressourceId)) return { erreur: FICHIER_INACCESSIBLE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ressources").select("id, titre, fichier, format, telechargeable").eq("id", ressourceId).maybeSingle();
  const ressource = error ? null : (data as Ligne | null);
  if (!ressource) return { erreur: FICHIER_INACCESSIBLE };
  if (ressource.telechargeable !== true) return { erreur: "Ce fichier se consulte sans téléchargement." };

  // Le nom de téléchargement est ajouté ici : passé en option, la bibliothèque l'encoderait deux fois
  // (« Données » deviendrait « Donn%C3%A9es »).
  const lien = await supabase.storage.from("ressources").createSignedUrl(texte(ressource.fichier), 60);
  const url = lien.error ? "" : texte(lien.data?.signedUrl);
  if (!url) return { erreur: LIEN_ECHEC };
  return { url: `${url}&download=${encodeURIComponent(nomDeTelechargement(texte(ressource.titre), texte(ressource.format)))}` };
}

const FIN_ECHEC = "La leçon n’a pas pu être marquée comme terminée. Réessayez.";

/** « Marquer comme terminée » : leçon sans vidéo seulement (la base refuse une leçon vidéo, qui se termine en la regardant). */
export async function terminerLecon(leconId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return { ok: false, erreur: "Connectez-vous pour enregistrer votre progression." };
  if (!UUID.test(leconId)) return { ok: false, erreur: FIN_ECHEC };
  const reponse = await supabase.rpc("terminer_lecon", { p_lecon: leconId });
  if (reponse.error) return { ok: false, erreur: FIN_ECHEC };
  // Programme, pourcentage et temps restant sont relus.
  refresh();
  return { ok: true };
}

/** Note la visite d'une leçon (dernière leçon ouverte, pour « Continuer »). Une erreur n'empêche rien. */
export async function ouvrirLecon(leconId: string): Promise<void> {
  if (!UUID.test(leconId)) return;
  try {
    const supabase = await createClient();
    await supabase.rpc("ouvrir_lecon", { p_lecon: leconId });
  } catch {
    // Base injoignable ou migration 0008 absente : la leçon s'affiche quand même.
  }
}


/**
 * Lien de consultation (visualiseur intégré, spec §6) : 60 s, sans téléchargement, pour une ressource en consultation
 * seule d'une leçon ouverte. Le visualiseur lit le fichier une fois, à l'ouverture.
 */
export async function lienConsultation(ressourceId: string): Promise<{ url: string; format: string } | { erreur: string }> {
  if (!UUID.test(ressourceId)) return { erreur: FICHIER_INACCESSIBLE };
  const supabase = await createClient();
  const { data, error } = await supabase.from("ressources").select("id, fichier, format, telechargeable").eq("id", ressourceId).maybeSingle();
  const ressource = error ? null : (data as Ligne | null);
  if (!ressource) return { erreur: FICHIER_INACCESSIBLE };
  if (ressource.telechargeable === true) return { erreur: "Ce fichier se télécharge." };
  const format = texte(ressource.format);
  if (!formatParMime(format)?.consultable) return { erreur: "Ce format ne s’affiche pas ici." };
  const lien = await supabase.storage.from("ressources").createSignedUrl(texte(ressource.fichier), 60);
  const url = lien.error ? "" : texte(lien.data?.signedUrl);
  return url ? { url, format } : { erreur: LIEN_ECHEC };
}
