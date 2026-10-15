"use server";

import { refresh } from "next/cache";
import { getShellUser } from "@/lib/auth/current-user";
import { estFonctionAbsente, texte, un } from "@/lib/contenus/lecture";
import { createClient } from "@/lib/supabase/server";
import { MIGRATION_EXERCICES } from "./conversion";

// Rendre, terminer et corriger un exercice (migration 0032) : la base vérifie l'accès, le fichier et le statut, et
// prévient le formateur ou l'étudiant.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const ENVOI_ECHEC = "Votre travail n’a pas pu être envoyé. Réessayez.";
const FIN_ECHEC = "L’exercice n’a pas pu être marqué comme terminé. Réessayez.";
const CORRECTION_ECHEC = "La correction n’a pas pu être enregistrée. Réessayez.";
const FICHIER_INACCESSIBLE = "Ce fichier n’est pas accessible.";
const LIEN_ECHEC = "Le lien de téléchargement n’a pas pu être créé. Réessayez.";

type Refus = { ok: false; message: string };

/** Le refus de la base (P0001, 42501) tel quel, la migration manquante, ou le message d'échec. */
function refus(error: { code?: string; message?: string }, echec: string): Refus {
  if (estFonctionAbsente(error)) return { ok: false, message: MIGRATION_EXERCICES };
  if ((error.code === "P0001" || error.code === "42501") && error.message) return { ok: false, message: error.message.replace(/'/g, "’") };
  return { ok: false, message: echec };
}

/** Le fichier, déjà déposé dans le dossier du compte (espace « rendus »), devient la version suivante du travail. */
export async function rendreExercice(leconId: string, fichier: string, nom: string, message: string): Promise<{ ok: true; version: number } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(leconId) || typeof fichier !== "string" || typeof nom !== "string") return { ok: false, message: ENVOI_ECHEC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rendre_exercice", {
    p_lecon: leconId,
    p_fichier: fichier,
    p_nom: nom,
    p_message: typeof message === "string" ? message : "",
  });
  if (error) return refus(error, ENVOI_ECHEC);
  refresh();
  return { ok: true, version: Number(un(data)?.version) || 1 };
}

/** « Marquer comme terminé » : un exercice simple. */
export async function terminerExercice(leconId: string): Promise<{ ok: true } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(leconId)) return { ok: false, message: FIN_ECHEC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("terminer_exercice", { p_lecon: leconId });
  if (error) return refus(error, FIN_ECHEC);
  refresh();
  return { ok: true };
}

/** « Valider l'exercice » ou « Demander une correction » (la base exige la remarque). */
export async function corrigerRendu(renduId: string, decision: "valide" | "a_corriger", remarque: string): Promise<{ ok: true } | Refus> {
  if (!(await getShellUser())) return { ok: false, message: SESSION_EXPIREE };
  if (!UUID.test(renduId) || (decision !== "valide" && decision !== "a_corriger")) return { ok: false, message: CORRECTION_ECHEC };
  const supabase = await createClient();
  const { error } = await supabase.rpc("corriger_rendu", { p_rendu: renduId, p_decision: decision, p_remarque: typeof remarque === "string" ? remarque : "" });
  if (error) return refus(error, CORRECTION_ECHEC);
  refresh();
  return { ok: true };
}

/** Lien de téléchargement (60 s) d'un travail, pour son auteur ou un correcteur, avec le nom du fichier déposé. */
export async function lienRendu(renduId: string): Promise<{ url: string } | { erreur: string }> {
  if (!UUID.test(renduId)) return { erreur: FICHIER_INACCESSIBLE };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("fichier_rendu", { p_rendu: renduId });
  const fichier = error ? null : un(data);
  const chemin = texte(fichier?.chemin);
  if (!chemin) return { erreur: FICHIER_INACCESSIBLE };
  // Le nom de téléchargement est ajouté ici : passé en option, la bibliothèque l'encoderait deux fois.
  const lien = await supabase.storage.from("rendus").createSignedUrl(chemin, 60);
  const url = lien.error ? "" : texte(lien.data?.signedUrl);
  if (!url) return { erreur: LIEN_ECHEC };
  const nom = texte(fichier?.nom).replace(/[/\\]/g, "-") || "travail";
  return { url: `${url}&download=${encodeURIComponent(nom)}` };
}
