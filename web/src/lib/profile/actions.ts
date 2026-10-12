"use server";

import { refresh } from "next/cache";
import { authErrorMessage } from "@/lib/auth/messages";
import { fieldErrorsFrom, type FormState } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";
import { profileSchema } from "./schemas";

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
