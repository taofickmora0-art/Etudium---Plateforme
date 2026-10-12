import { z } from "zod";

// Règles de saisie des écrans de compte (spec du lot 0, §4 et §7). Messages en français, vouvoiement.

/** Adresse nettoyée (espaces, majuscules) : la même sert à l'inscription, au code et à la connexion. */
export const emailSchema = z
  .string({ error: "Entrez une adresse e-mail valide." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Entrez une adresse e-mail valide." }));

export const passwordSchema = z.string({ error: "Au moins 8 caractères." }).min(8, { error: "Au moins 8 caractères." });

export const nameSchema = (vide: string) =>
  z.string({ error: vide }).trim().min(1, { error: vide }).max(50, { error: "50 caractères au maximum." });

export const signUpSchema = z.object({
  prenom: nameSchema("Entrez votre prénom."),
  nom: nameSchema("Entrez votre nom."),
  email: emailSchema,
  password: passwordSchema,
  conditions: z.literal("on", { error: "Acceptez les conditions pour créer votre compte." }),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Entrez votre mot de passe." }).min(1, { error: "Entrez votre mot de passe." }),
  remember: z.boolean(),
});

export const codeSchema = z.string({ error: "Saisissez les 6 chiffres du code." }).regex(/^\d{6}$/, { error: "Saisissez les 6 chiffres du code." });

export const resetRequestSchema = z.object({ email: emailSchema });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirmation: z.string() })
  .refine((v) => v.password === v.confirmation, { error: "Les deux mots de passe ne correspondent pas.", path: ["confirmation"] });

/** État renvoyé par une action serveur à son formulaire. `values` ne contient jamais de mot de passe. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
  /** Page où aller après un succès (création) : le navigateur s'y rend lui-même (pas de redirect() dans l'action). */
  redirection?: string;
};

export const IDLE: FormState = { status: "idle" };

/** Premier message d'erreur de chaque champ, pour l'afficher sous le champ. */
export function fieldErrorsFrom(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}
