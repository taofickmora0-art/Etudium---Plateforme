import { z } from "zod";
import { nameSchema, passwordSchema } from "@/lib/auth/schemas";
import { NIVEAUX, PAYS } from "./options";
import { PREFERENCE_KEYS, type PreferenceKey } from "./preferences";

// Règles de saisie du profil (onglets Informations, Notifications, Sécurité). Messages en français, vouvoiement.

/** Texte facultatif : nettoyé des espaces au bord ; vide → null. */
const facultatif = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères au maximum.` })
    .transform((v) => (v === "" ? null : v));

/** Valeur d'une liste, ou vide → null. */
const dansLaListe = (valeurs: string[], message: string) =>
  z
    .string()
    .trim()
    .refine((v) => v === "" || valeurs.includes(v), { error: message })
    .transform((v) => (v === "" ? null : v));

export const profileSchema = z.object({
  prenom: nameSchema("Entrez votre prénom."),
  nom: nameSchema("Entrez votre nom."),
  telephone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^[+0-9 ().-]{6,30}$/.test(v), { error: "Saisissez un numéro de téléphone valide." })
    .transform((v) => (v === "" ? null : v)),
  pays: dansLaListe(
    PAYS.map((p) => p.value),
    "Choisissez un pays de la liste.",
  ),
  niveau_etudes: dansLaListe(
    NIVEAUX.map((n) => n.value),
    "Choisissez un niveau de la liste.",
  ),
  etablissement: facultatif(120),
  filiere: facultatif(120),
  objectifs: facultatif(500),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const preferencesSchema = z.strictObject(
  Object.fromEntries(PREFERENCE_KEYS.map((k) => [k, z.boolean()])) as Record<PreferenceKey, z.ZodBoolean>,
);

export const passwordChangeSchema = z.object({
  current: z.string().min(1, { error: "Saisissez votre mot de passe actuel." }),
  password: passwordSchema,
});
