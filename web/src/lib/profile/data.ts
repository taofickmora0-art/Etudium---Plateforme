import { cache } from "react";
import { demoModeActive, getAuthUser, getShellUser } from "@/lib/auth/current-user";
import { DEMO_PROFILE } from "@/lib/demo-user";
import { createClient } from "@/lib/supabase/server";
import { readPreferences, type NotificationPreferences } from "./preferences";

/** Ce que la page « Mon profil » affiche et modifie. */
export type ProfileData = {
  prenom: string;
  nom: string;
  email: string;
  initials: string;
  telephone: string | null;
  pays: string | null;
  niveauEtudes: string | null;
  etablissement: string | null;
  filiere: string | null;
  objectifs: string | null;
  photoUrl: string | null;
  preferences: NotificationPreferences;
  /** Le compte a un mot de passe Étudium (inscription par e-mail) ; sinon il se connecte seulement avec Google. */
  hasPassword: boolean;
  googleLinked: boolean;
};

const texte = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : null);

/** Le profil de la personne connectée, lu une seule fois par requête. */
export const getProfile = cache(async (): Promise<ProfileData | null> => {
  if (demoModeActive()) return DEMO_PROFILE;
  const [user, shell] = await Promise.all([getAuthUser(), getShellUser()]);
  if (!user || !shell) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profils")
    .select("telephone, pays, niveau_etudes, etablissement, filiere, objectifs, preferences_notifications")
    .eq("id", user.id)
    .maybeSingle();
  const fournisseurs = new Set((user.identities ?? []).map((i) => i.provider));

  return {
    prenom: shell.prenom,
    nom: shell.nom,
    email: shell.email,
    initials: shell.initials,
    photoUrl: shell.photoUrl,
    telephone: texte(data?.telephone),
    pays: texte(data?.pays),
    niveauEtudes: texte(data?.niveau_etudes),
    etablissement: texte(data?.etablissement),
    filiere: texte(data?.filiere),
    objectifs: texte(data?.objectifs),
    preferences: readPreferences(data?.preferences_notifications),
    // Un compte Google qui a créé son mot de passe (par le lien reçu) le dit dans ses métadonnées.
    hasPassword: fournisseurs.has("email") || user.user_metadata?.mot_de_passe === true,
    googleLinked: fournisseurs.has("google"),
  };
});
