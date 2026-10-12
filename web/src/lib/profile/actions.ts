"use server";

import { refresh } from "next/cache";
import { clearLocalSession } from "@/lib/auth/local-session";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrorsFrom, type FormState } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { detectImageType, PHOTO_ECHEC, PHOTO_MAX_OCTETS, PHOTO_TROP_LOURDE, PHOTO_TYPE } from "./photo";
import type { NotificationPreferences } from "./preferences";
import { passwordChangeSchema, preferencesSchema, profileSchema } from "./schemas";

// Actions serveur de « Mon profil ». Chacune revérifie la session auprès de Supabase : on ne fait jamais confiance au navigateur.

const SESSION_EXPIREE = "Votre session a expiré. Reconnectez-vous.";
const texte = (formData: FormData, nom: string) => String(formData.get(nom) ?? "");

/** Client Supabase et compte connecté (null si la session n'est plus valable). */
async function sessionUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return { supabase, user: error ? null : (data?.user ?? null) };
}

const CHAMPS_INFORMATIONS = ["prenom", "nom", "telephone", "pays", "niveau_etudes", "etablissement", "filiere", "objectifs"] as const;

/** Onglet Informations (NdProfil, NdProfilEnregistre). */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = Object.fromEntries(CHAMPS_INFORMATIONS.map((c) => [c, texte(formData, c)]));
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };

  try {
    const { supabase, user } = await sessionUser();
    if (!user) return { status: "error", message: SESSION_EXPIREE, values };
    const { error } = await supabase.from("profils").update(parsed.data).eq("id", user.id);
    if (error) return { status: "error", message: authErrorMessage(null), values };
  } catch {
    return { status: "error", message: authErrorMessage(null), values };
  }
  // Le nom affiché dans l'en-tête et les menus suit.
  refresh();
  return { status: "success", values };
}

/** Photo de profil (NdProfil, « Changer la photo ») : contrôlée ici même si le navigateur l'a déjà fait. */
export async function updatePhoto(_prev: FormState, formData: FormData): Promise<FormState> {
  const fichier = formData.get("photo");
  if (!(fichier instanceof File) || fichier.size === 0) return { status: "error", message: PHOTO_TYPE };
  if (fichier.size > PHOTO_MAX_OCTETS) return { status: "error", message: PHOTO_TROP_LOURDE };
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const type = detectImageType(octets);
  if (!type) return { status: "error", message: PHOTO_TYPE };

  try {
    const { supabase, user } = await sessionUser();
    if (!user) return { status: "error", message: SESSION_EXPIREE };
    // Nom aléatoire à chaque envoi : l'adresse change, aucun cache ne montre l'ancienne photo.
    const chemin = `${user.id}/${crypto.randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
    const photos = supabase.storage.from("photos-profil");
    const envoi = await photos.upload(chemin, octets, { contentType: type, upsert: false, cacheControl: "31536000" });
    if (envoi.error) return { status: "error", message: PHOTO_ECHEC };
    const { data } = photos.getPublicUrl(chemin);
    const maj = await supabase.from("profils").update({ photo_url: data.publicUrl }).eq("id", user.id);
    if (maj.error) {
      await photos.remove([chemin]);
      return { status: "error", message: PHOTO_ECHEC };
    }
    // Les anciennes photos du dossier ne servent plus.
    const { data: fichiers } = await photos.list(user.id);
    const anciennes = (fichiers ?? []).map((f) => `${user.id}/${f.name}`).filter((c) => c !== chemin);
    if (anciennes.length > 0) await photos.remove(anciennes);
  } catch {
    return { status: "error", message: PHOTO_ECHEC };
  }
  refresh();
  return { status: "success" };
}

/** Onglet Notifications : enregistre l'ensemble des préférences (le dernier état choisi). */
export async function updatePreferences(prefs: NotificationPreferences): Promise<{ ok: boolean }> {
  const parsed = preferencesSchema.safeParse(prefs);
  if (!parsed.success) return { ok: false };
  try {
    const { supabase, user } = await sessionUser();
    if (!user) return { ok: false };
    const { error } = await supabase.from("profils").update({ preferences_notifications: parsed.data }).eq("id", user.id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Onglet Sécurité (NdMotDePasseModifie) : le mot de passe actuel est vérifié d'abord (spec §7), puis les autres appareils
 * sont déconnectés. Celui-ci reste connecté : la vérification lui a ouvert une session neuve.
 */
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordChangeSchema.safeParse({ current: texte(formData, "current"), password: texte(formData, "password") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  try {
    const { supabase, user } = await sessionUser();
    if (!user?.email) return { status: "error", message: SESSION_EXPIREE };
    const verification = await supabase.auth.signInWithPassword({ email: user.email, password: parsed.data.current });
    if (verification.error) {
      if (verification.error.code === "invalid_credentials") return { status: "error", fieldErrors: { current: "Le mot de passe actuel est incorrect." } };
      return { status: "error", message: authErrorMessage(verification.error) };
    }
    const changement = await supabase.auth.updateUser({ password: parsed.data.password });
    if (changement.error) return { status: "error", message: authErrorMessage(changement.error) };
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    return { status: "error", message: authErrorMessage(null) };
  }
  return { status: "success" };
}

/**
 * Suppression du compte (NdProfilSuppression). Lève une erreur en cas d'échec : la fenêtre le dit et on peut réessayer.
 * Ordre : photos, puis adresse de la photo (si la base refuse ensuite, le profil n'affiche pas une photo disparue),
 * puis le compte (fonction supprimer_mon_compte, migration 0002 ; profil et rôles suivent), puis la session de l'appareil.
 */
export async function deleteAccount(): Promise<void> {
  const { supabase, user } = await sessionUser();
  if (!user) throw new Error("Session expirée");
  const photos = supabase.storage.from("photos-profil");
  const { data: fichiers } = await photos.list(user.id);
  const chemins = (fichiers ?? []).map((f) => `${user.id}/${f.name}`);
  if (chemins.length > 0) {
    await photos.remove(chemins);
    await supabase.from("profils").update({ photo_url: null }).eq("id", user.id);
  }
  const { error } = await supabase.rpc("supprimer_mon_compte");
  if (error) throw new Error("Suppression refusée");
  await clearLocalSession();
}
