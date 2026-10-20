"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearLocalSession } from "./local-session";
import { authErrorMessage, safeNext } from "./messages";
import { codeSchema, fieldErrorsFrom, newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema, type FormState } from "./schemas";
import { PENDING_EMAIL_COOKIE, PENDING_EMAIL_MAX_AGE, REMEMBER_COOKIE } from "./session-cookies";
import { cheminFormateur, estFormateurConnecte } from "./espace-formateur";
import { estSuspendu, MESSAGE_SUSPENDU } from "./suspension";

// Actions serveur des écrans de compte. `redirect()` est toujours appelé hors des blocs try (il lève une erreur).

const UN_AN = 365 * 24 * 60 * 60;
const securise = process.env.NODE_ENV === "production";
const texte = (formData: FormData, nom: string) => String(formData.get(nom) ?? "");

/** Adresse du site vue par le navigateur (pour les liens de retour de Google et des e-mails). */
async function origine() {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

/** Garde l'adresse à vérifier dans un cookie (jamais dans l'URL). */
async function retenirAdresse(email: string) {
  (await cookies()).set(PENDING_EMAIL_COOKIE, email, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: securise,
    maxAge: PENDING_EMAIL_MAX_AGE,
  });
}

/** Connexion par e-mail et mot de passe (NdConnexion). */
export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const brut = { email: texte(formData, "email"), password: texte(formData, "password"), remember: formData.get("remember") === "on" };
  // Le choix « Se souvenir de moi » revient avec l'erreur : la case ne doit pas se recocher toute seule.
  const souvenir = brut.remember ? "1" : "0";
  const parsed = signInSchema.safeParse(brut);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: { email: brut.email, remember: souvenir } };
  const { email, password, remember } = parsed.data;

  (await cookies()).set(REMEMBER_COOKIE, remember ? "1" : "0", { path: "/", httpOnly: true, sameSite: "lax", secure: securise, maxAge: UN_AN });

  let erreur: { code?: string; status?: number } | null = null;
  let nonVerifie = false;
  let suspendu = false;
  let formateur = false;
  try {
    const supabase = await createClient({ remember });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === "email_not_confirmed") {
      // Le compte existe mais l'adresse n'a pas été vérifiée : on renvoie un code et on y retourne.
      await supabase.auth.resend({ type: "signup", email });
      nonVerifie = true;
    } else if (error) {
      erreur = error;
    } else if (await estSuspendu(supabase)) {
      // Compte suspendu (spec des utilisateurs, §4) : la session tout juste ouverte est aussitôt refermée.
      await supabase.auth.signOut();
      suspendu = true;
    } else {
      formateur = await estFormateurConnecte(supabase);
    }
  } catch {
    return { status: "error", message: authErrorMessage(null), values: { email, remember: souvenir } };
  }

  if (nonVerifie) {
    await retenirAdresse(email);
    redirect("/verification-email");
  }
  if (erreur) return { status: "error", message: authErrorMessage(erreur), values: { email, remember: souvenir } };
  if (suspendu) return { status: "error", message: MESSAGE_SUSPENDU, values: { email, remember: souvenir } };
  // Un formateur arrive dans son espace (restructuration R1) : l'équivalent de la page demandée, sinon son tableau de bord.
  const cible = safeNext(texte(formData, "next"));
  redirect(formateur ? cheminFormateur(cible) : cible);
}

/** « Continuer avec Google » : part chez Google, revient par /auth/callback. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(texte(formData, "next"));
  // Choix « Se souvenir de moi » de la page de connexion (l'inscription envoie toujours « on ») : appliqué au retour.
  const souvenir = formData.get("remember") === "on";
  (await cookies()).set(REMEMBER_COOKIE, souvenir ? "1" : "0", { path: "/", httpOnly: true, sameSite: "lax", secure: securise, maxAge: UN_AN });
  let url: string | null = null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${await origine()}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (!error) url = data.url;
  } catch {
    url = null;
  }
  redirect(url ?? `/connexion?erreur=google&next=${encodeURIComponent(next)}`);
}

/** Inscription par e-mail (NdInscription) : Supabase envoie un code à 6 chiffres, valable 10 minutes. */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const brut = {
    prenom: texte(formData, "prenom"),
    nom: texte(formData, "nom"),
    email: texte(formData, "email"),
    password: texte(formData, "password"),
    conditions: formData.get("conditions") ?? undefined,
  };
  const values = { prenom: brut.prenom, nom: brut.nom, email: brut.email, conditions: brut.conditions === "on" ? "on" : "" };
  const parsed = signUpSchema.safeParse(brut);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values };
  const { prenom, nom, email, password } = parsed.data;

  let erreur: { code?: string; status?: number } | null = null;
  try {
    const supabase = await createClient();
    // Si l'adresse a déjà un compte, Supabase répond sans erreur et sans rien révéler : même parcours.
    const { error } = await supabase.auth.signUp({ email, password, options: { data: { prenom, nom } } });
    erreur = error;
  } catch {
    return { status: "error", message: authErrorMessage(null), values };
  }
  if (erreur) return { status: "error", message: authErrorMessage(erreur), values };

  await retenirAdresse(email);
  redirect("/verification-email");
}

/** Adresse en attente de vérification, ou retour à l'inscription s'il n'y en a pas. */
async function adresseEnAttente(): Promise<string> {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) redirect("/inscription");
  return email;
}

/** Vérification du code reçu par e-mail (NdCodeVerification). */
export async function verifyCode(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = await adresseEnAttente();
  const parsed = codeSchema.safeParse(texte(formData, "code"));
  if (!parsed.success) return { status: "error", fieldErrors: { code: parsed.error.issues[0]?.message } };

  let erreur: { code?: string; status?: number } | null = null;
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ email, token: parsed.data, type: "email" });
    erreur = error;
  } catch {
    return { status: "error", message: authErrorMessage(null) };
  }
  if (erreur) return { status: "error", message: authErrorMessage(erreur) };

  (await cookies()).delete(PENDING_EMAIL_COOKIE);
  redirect("/accueil");
}

/** « Renvoyer le code » : nouveau code pour l'adresse en attente. */
export async function resendCode(prev: FormState): Promise<FormState> {
  void prev; // état précédent fourni par useActionState, inutile ici
  const email = await adresseEnAttente();
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return { status: "error", message: authErrorMessage(error) };
  } catch {
    return { status: "error", message: authErrorMessage(null) };
  }
  return { status: "success", message: "Un nouveau code vous a été envoyé." };
}

/**
 * « Mot de passe oublié » (NdMotDePasse) : envoie le lien, et répond toujours la même chose, que le compte
 * existe ou non (spec §4), sauf quand Supabase limite les envois.
 */
export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const brut = texte(formData, "email");
  const parsed = resetRequestSchema.safeParse({ email: brut });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: { email: brut } };
  const { email } = parsed.data;
  try {
    const supabase = await createClient();
    // Réponse ignorée : Supabase ne renvoie d'erreur (limite d'envoi, envoi raté) que pour un compte existant.
    // L'afficher dirait si le compte existe ; l'écran est donc le même dans tous les cas.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await origine()}/auth/confirm?next=/nouveau-mot-de-passe`,
    });
  } catch {
    return { status: "error", message: authErrorMessage(null), values: { email } };
  }
  return { status: "success", values: { email } };
}

const LIEN_EXPIRE = "Ce lien a expiré. Demandez-en un nouveau.";
/** Temps laissé pour choisir le nouveau mot de passe après avoir ouvert le lien reçu par e-mail. */
const PREUVE_PAR_EMAIL_SECONDES = 15 * 60;

/**
 * La session vient-elle d'un lien reçu par e-mail, il y a peu ? Le jeton signé par Supabase dit comment la session
 * a été ouverte (« amr ») : la vérification du lien y figure comme « otp » (« recovery » selon les versions).
 * Une session ouverte par mot de passe ou par Google ne suffit pas : sur un ordinateur partagé resté connecté,
 * personne ne doit pouvoir changer le mot de passe sans le lien.
 */
function preuveParEmailRecente(amr: unknown, maintenant: number): boolean {
  if (!Array.isArray(amr)) return false;
  return amr.some((entree: unknown) => {
    const { method, timestamp } = (entree ?? {}) as { method?: unknown; timestamp?: unknown };
    return (method === "otp" || method === "recovery") && typeof timestamp === "number" && maintenant - timestamp <= PREUVE_PAR_EMAIL_SECONDES;
  });
}

/** Nouveau mot de passe (NdReinitialisation), ouvert depuis le lien reçu ; les autres appareils sont déconnectés. */
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: texte(formData, "password"), confirmation: texte(formData, "confirmation") });
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error) };

  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub || !preuveParEmailRecente(data.claims.amr, Math.floor(Date.now() / 1000))) {
      return { status: "error", message: LIEN_EXPIRE };
    }
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    if (error) {
      const sansSession = (error as { name?: string }).name === "AuthSessionMissingError" || error.code === "session_not_found";
      return { status: "error", message: sansSession ? LIEN_EXPIRE : authErrorMessage(error) };
    }
    await supabase.auth.signOut({ scope: "others" });
  } catch {
    return { status: "error", message: authErrorMessage(null) };
  }
  redirect("/accueil");
}

/**
 * Déconnexion (NdDeconnexion) : ferme la session de cet appareil seulement. Pas de redirection ici :
 * l'écran recharge entièrement la page de connexion (rien du compte ne reste en mémoire).
 */
export async function signOut(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Base injoignable : la session ne peut pas être fermée chez Supabase ; elle l'est tout de même sur cet appareil (ci-dessous).
  }
  // Effacée dans tous les cas, sinon le rechargement ramènerait à l'accueil.
  await clearLocalSession();
}
