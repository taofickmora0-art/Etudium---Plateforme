import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import type { Role } from "@/lib/auth/permissions";
import { DEMO_USER } from "@/lib/demo-user";
import { getPublicEnv } from "@/lib/env";
import { photoPublicUrl } from "@/lib/profile/photo-url";
import { createClient } from "@/lib/supabase/server";
import { isDemoMode } from "./routing";
import { AuthUnavailableError, isSessionClosed } from "./session-state";

/** Ce que la coque affiche de la personne connectée (en-tête, menu du profil, page « Profil » du téléphone). */
export type ShellUser = {
  prenom: string;
  nom: string;
  initials: string;
  email: string;
  roles: Role[];
  /** Ligne sous le nom sur la page « Profil » du téléphone. */
  statut: string;
  formule: string;
  serie: number;
  points: number;
  /** Adresse publique de la photo de profil, ou null (initiales). */
  photoUrl: string | null;
};

const ORDRE_DES_ROLES: Role[] = ["etudiant", "formateur", "moderateur", "admin", "super_admin"];

/** Mode démonstration (voir `isDemoMode`) : base non configurée, sur l'ordinateur de développement. */
export function demoModeActive(): boolean {
  let configured = true;
  try {
    getPublicEnv();
  } catch {
    configured = false;
  }
  return isDemoMode({ configured, nodeEnv: process.env.NODE_ENV });
}

type Metadonnees = Record<string, unknown>;
const chaine = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Prénom et nom tirés des données d'inscription : formulaire (prenom, nom) ou Google (given_name, family_name, full_name). */
function nomDepuisInscription(meta: Metadonnees) {
  const complet = chaine(meta.full_name) || chaine(meta.name);
  const [premier = "", ...reste] = complet.split(/\s+/).filter(Boolean);
  return {
    prenom: chaine(meta.prenom) || chaine(meta.given_name) || premier,
    nom: chaine(meta.nom) || chaine(meta.family_name) || reste.join(" "),
  };
}

const initiales = (prenom: string, nom: string, email: string) =>
  ((prenom[0] ?? "") + (nom[0] ?? "")).toUpperCase() || (email[0] ?? "?").toUpperCase();

/**
 * Le compte connecté, vérifié auprès de Supabase (getUser) une seule fois par requête. Contrairement à la lecture du jeton
 * sur place (getClaims, gardée par le proxy), Supabase voit une session fermée ailleurs : mot de passe changé, compte supprimé.
 * Un incident passager (réseau, Supabase indisponible) lève AuthUnavailableError : la page propose de réessayer
 * (error.tsx) au lieu de déconnecter. Hors mode démonstration seulement.
 */
export const getAuthUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    if (isSessionClosed(error)) return null;
    throw new AuthUnavailableError();
  }
  return data?.user ?? null;
});

/**
 * La personne connectée, lue une seule fois par requête (React.cache) : session, profil et rôles.
 * Tant que le profil n'est pas lisible, on se rabat sur les données d'inscription.
 * Série et points arrivent au lot 6, les formules payantes au lot 2.
 */
export const getShellUser = cache(async (): Promise<ShellUser | null> => {
  if (demoModeActive()) return DEMO_USER;

  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();
  const [profil, roles] = await Promise.all([
    supabase.from("profils").select("prenom, nom, photo_url").eq("id", user.id).maybeSingle(),
    supabase.from("roles").select("role").eq("profil_id", user.id),
  ]);

  const inscription = nomDepuisInscription((user.user_metadata as Metadonnees | undefined) ?? {});
  const prenom = chaine(profil.data?.prenom) || inscription.prenom;
  const nom = chaine(profil.data?.nom) || inscription.nom;
  const email = chaine(user.email);
  const lus = new Set(((roles.data as { role: Role }[] | null) ?? []).map((r) => r.role));
  const tries = ORDRE_DES_ROLES.filter((r) => lus.has(r));

  return {
    prenom,
    nom,
    initials: initiales(prenom, nom, email),
    email,
    roles: tries.length > 0 ? tries : ["etudiant"],
    statut: "Étudiant·e",
    formule: "Gratuite",
    serie: 0,
    points: 0,
    photoUrl: photoPublicUrl(chaine(profil.data?.photo_url)),
  };
});
