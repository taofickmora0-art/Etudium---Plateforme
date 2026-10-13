"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { COMMENTAIRE_MAX } from "./regles";

// Avis (spec du lot 1, Q8, §7) : écrits par leur auteur à partir de 50 % de progression, masqués par l'équipe.
// Toutes les écritures passent par les fonctions de la migration 0010, qui vérifient elles-mêmes ces règles.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Resultat = { ok: true } | { ok: false; erreur: string };

async function compteConnecte() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, compte: error ? null : (data?.user ?? null) };
}

/** Publie ou modifie son avis : une note de 1 à 5, un commentaire facultatif (espaces de début et de fin retirés). */
export async function enregistrerAvis(formationId: string, note: number, commentaire: string): Promise<Resultat> {
  const echec = "Votre avis n’a pas pu être enregistré. Réessayez.";
  if (!Number.isInteger(note) || note < 1 || note > 5) return { ok: false, erreur: "Choisissez une note de 1 à 5 étoiles." };
  const texte = (commentaire ?? "").trim();
  if (texte.length > COMMENTAIRE_MAX) return { ok: false, erreur: "Votre commentaire dépasse 1 000 caractères." };
  const { supabase, compte } = await compteConnecte();
  if (!compte) return { ok: false, erreur: "Connectez-vous pour laisser un avis." };
  if (!UUID.test(formationId)) return { ok: false, erreur: echec };
  const { error } = await supabase.rpc("enregistrer_avis", { p_formation: formationId, p_note: note, p_commentaire: texte });
  if (error) return { ok: false, erreur: error.code === "42501" ? "Vous pourrez laisser un avis à partir de 50 % de progression." : echec };
  refresh();
  return { ok: true };
}

/** Supprime son avis (toujours permis). */
export async function supprimerAvis(formationId: string): Promise<Resultat> {
  const echec = "Votre avis n’a pas pu être supprimé. Réessayez.";
  const { supabase, compte } = await compteConnecte();
  if (!compte) return { ok: false, erreur: "Connectez-vous pour gérer votre avis." };
  if (!UUID.test(formationId)) return { ok: false, erreur: echec };
  const { error } = await supabase.rpc("supprimer_avis", { p_formation: formationId });
  if (error) return { ok: false, erreur: echec };
  refresh();
  return { ok: true };
}

/** Masque ou réaffiche un avis (équipe seulement, vérifié par la base). */
export async function masquerAvis(avisId: string, masque: boolean): Promise<Resultat> {
  const echec = "L’avis n’a pas pu être modifié. Réessayez.";
  const { supabase, compte } = await compteConnecte();
  if (!compte || !UUID.test(avisId)) return { ok: false, erreur: echec };
  const { error } = await supabase.rpc("masquer_avis", { p_avis: avisId, p_masque: masque });
  if (error) return { ok: false, erreur: echec };
  refresh();
  return { ok: true };
}
