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
