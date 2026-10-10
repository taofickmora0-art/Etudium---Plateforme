"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authErrorMessage, safeNext } from "./messages";
import { fieldErrorsFrom, signInSchema, type FormState } from "./schemas";
import { PENDING_EMAIL_COOKIE, PENDING_EMAIL_MAX_AGE, REMEMBER_COOKIE } from "./session-cookies";

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
  const parsed = signInSchema.safeParse(brut);
  if (!parsed.success) return { status: "error", fieldErrors: fieldErrorsFrom(parsed.error), values: { email: brut.email } };
  const { email, password, remember } = parsed.data;

  (await cookies()).set(REMEMBER_COOKIE, remember ? "1" : "0", { path: "/", httpOnly: true, sameSite: "lax", secure: securise, maxAge: UN_AN });

  let erreur: { code?: string; status?: number } | null = null;
  let nonVerifie = false;
  try {
    const supabase = await createClient({ remember });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error?.code === "email_not_confirmed") {
      // Le compte existe mais l'adresse n'a pas été vérifiée : on renvoie un code et on y retourne.
      await supabase.auth.resend({ type: "signup", email });
      nonVerifie = true;
    } else if (error) {
      erreur = error;
    }
  } catch {
    return { status: "error", message: authErrorMessage(null), values: { email } };
  }

  if (nonVerifie) {
    await retenirAdresse(email);
    redirect("/verification-email");
  }
  if (erreur) return { status: "error", message: authErrorMessage(erreur), values: { email } };
  redirect(safeNext(texte(formData, "next")));
}

/** « Continuer avec Google » : part chez Google, revient par /auth/callback. */
export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(texte(formData, "next"));
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
  redirect(url ?? "/connexion?erreur=google");
}
