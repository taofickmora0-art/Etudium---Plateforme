import { z } from "zod";
import { FORMATS, formatParMime, RESSOURCE_MAX_OCTETS } from "./fichiers";

// Règles de saisie du back-office (spec du lot 1, §10) : les mêmes limites que la base (migration 0004).

const ADRESSE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MESSAGE_ADRESSE = "Lettres minuscules, chiffres et tirets seulement.";

const maximum = (max: number) => ({ error: `${max} caractères au maximum.` });
const requis = (vide: string, max: number) => z.string({ error: vide }).trim().min(1, { error: vide }).max(max, maximum(max));
const facultatif = (max: number) => z.string().trim().max(max, maximum(max));

const adresse = z.string({ error: MESSAGE_ADRESSE }).trim().max(80, maximum(80)).regex(ADRESSE, { error: MESSAGE_ADRESSE });

/** Listes saisies une par ligne (objectifs, compétences, points clés). */
const liste = z
  .array(z.string().max(200, { error: "200 caractères au maximum par ligne." }))
  .max(20, { error: "20 lignes au maximum." });

/** Découpe un texte en lignes non vides, sans espaces autour. */
export const lignes = (texte: string) =>
  texte
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

export const parcoursSchema = z.object({
  nom: requis("Entrez le nom du parcours.", 80),
  nom_court: requis("Entrez le nom court.", 30),
  slug: adresse,
  description: facultatif(500),
  couleur: z.enum(["academique", "digital", "business"], { error: "Choisissez une couleur." }),
  actif: z.boolean(),
});

export const formateurSchema = z.object({
  nom: requis("Entrez le nom du formateur.", 80),
  titre: facultatif(120),
  domaine: facultatif(120),
  presentation: facultatif(600),
});

const SEUIL = { error: "Entre 50 et 100 %." };
const PRIX = { error: "Un prix positif, en FCFA." };

export const formationInfosSchema = z.object({
  titre: requis("Entrez le titre de la formation.", 120),
  slug: adresse,
  resume: facultatif(160),
  description: facultatif(2000),
  objectifs: liste,
  competences: liste,
  niveau: z.enum(["debutant", "intermediaire", "avance"], { error: "Choisissez un niveau." }),
  formateur_id: z.uuid({ error: "Choisissez un formateur de la liste." }).nullable(),
  gratuite: z.boolean(),
  achat_separe: z.boolean(),
  prix_fcfa: z.number(PRIX).int(PRIX).min(0, PRIX).nullable(),
  badge: z.enum(["populaire", "nouveau"], { error: "Choisissez un badge de la liste." }).nullable(),
  seuil_video: z.number(SEUIL).int(SEUIL).min(50, SEUIL).max(100, SEUIL),
});

export const moduleSchema = z.object({ titre: requis("Entrez le titre du module.", 120) });

export const leconSchema = z.object({
  titre: requis("Entrez le titre de la leçon.", 120),
  titre_court: facultatif(40),
  duree_secondes: z.number().int().min(0),
  apercu: z.boolean(),
  resume: facultatif(1000),
  points_cles: liste,
  texte: facultatif(20000),
});

export const ressourceSchema = z
  .object({
    titre: requis("Entrez le titre du fichier.", 120),
    fichier: z.string().min(1),
    format: z.enum(FORMATS.map((f) => f.mime) as [string, ...string[]], { error: "Format non accepté." }),
    taille_octets: z.number().int().min(0).max(RESSOURCE_MAX_OCTETS, { error: "Ce fichier dépasse 50 Mo." }),
    telechargeable: z.boolean(),
  })
  .refine((r) => r.telechargeable || formatParMime(r.format)?.consultable === true, {
    error: "Seuls les PDF et les images peuvent être en consultation seule.",
    path: ["telechargeable"],
  });
