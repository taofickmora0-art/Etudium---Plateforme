import { fieldErrorsFrom } from "@/lib/auth/schemas";
import { parseDuree } from "@/lib/admin/duree";
import { formationInfosSchema, leconSchema } from "@/lib/admin/schemas";
import { parseVideoUrl, videoLink } from "@/lib/admin/video";
import { depuisMarkdown, documentLu, texteDuDocument, validerDocument } from "@/lib/lecon/document";
import { estFournisseur, estMesuree, messageLienCourt } from "@/lib/video/plateformes";
import type { EtatEdition, SaisieInfos, SaisieLecon } from "./types";

// Les saisies de l'éditeur (fin du lot 4, spec §2) : vérifiées avec les règles du back-office avant de partir en base
// (mêmes messages qu'à l'enregistrement au clic), puis mises dans la forme des brouillons (0056). Et l'inverse : les
// données lues en base, rendues à l'éditeur.

const LIEN_INCONNU = "Ce lien n’est pas une vidéo YouTube, Vimeo, TikTok, Tella, Loom, ScreenPal ou Google Drive.";
const DUREE_INVALIDE = "Durée au format 12:40.";
const DUREE_REQUISE = "Saisissez la durée de la vidéo : elle sert à mesurer le temps regardé.";

type Normalise = { ok: true; donnees: Record<string, unknown> } | { ok: false; erreurs: Record<string, string> };

const lignesPropres = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);

/** Une leçon saisie, vérifiée, dans la forme de `brouillons_lecons.donnees`. */
export function normaliserSaisieLecon(s: SaisieLecon): Normalise {
  const lien = s.lienVideo.trim();
  const video = lien ? parseVideoUrl(lien) : null;
  const duree = parseDuree(s.duree);
  const doc = validerDocument(s.document);
  const texte = doc.ok ? texteDuDocument(doc.document) : "";
  const parsed = leconSchema.safeParse({
    titre: s.titre,
    titre_court: s.titreCourt,
    duree_secondes: duree ?? 0,
    apercu: false,
    resume: s.resume,
    points_cles: lignesPropres(s.pointsCles),
    texte,
  });
  const erreurs = (parsed.success ? {} : fieldErrorsFrom(parsed.error)) as Record<string, string>;
  if (duree === null) erreurs.duree = DUREE_INVALIDE;
  else if (video && estMesuree(video.fournisseur) && duree === 0) erreurs.duree = DUREE_REQUISE;
  if (lien && !video) erreurs.video = messageLienCourt(lien) ?? LIEN_INCONNU;
  if (!doc.ok) erreurs.texte = doc.message;
  if (!parsed.success || !doc.ok || Object.keys(erreurs).length > 0) return { ok: false, erreurs };
  return {
    ok: true,
    donnees: {
      titre: parsed.data.titre,
      titre_court: parsed.data.titre_court || null,
      resume: parsed.data.resume,
      points_cles: parsed.data.points_cles,
      video_fournisseur: video?.fournisseur ?? null,
      video_id: video?.id ?? null,
      duree_secondes: duree,
      document: doc.document,
      texte,
    },
  };
}

const infosSchema = formationInfosSchema.pick({ titre: true, resume: true, description: true, objectifs: true, competences: true, niveau: true });

/** Les informations générales saisies, vérifiées, dans la forme de `brouillons_formations.donnees`. */
export function normaliserSaisieInfos(s: SaisieInfos): Normalise {
  const parsed = infosSchema.safeParse({ ...s, objectifs: lignesPropres(s.objectifs), competences: lignesPropres(s.competences) });
  if (!parsed.success) return { ok: false, erreurs: fieldErrorsFrom(parsed.error) as Record<string, string> };
  return { ok: true, donnees: parsed.data };
}

type Brut = Record<string, unknown>;
const chaine = (v: unknown) => (typeof v === "string" ? v : "");
const chaines = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const minutesSecondes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Les données d'une leçon lues en base (brouillon ou en ligne), rendues à l'éditeur. */
export function versSaisieLecon(brut: unknown): SaisieLecon {
  const d = (brut && typeof brut === "object" ? brut : {}) as Brut;
  const fournisseur = d.video_fournisseur;
  const id = chaine(d.video_id);
  const duree = Math.max(0, Math.round(Number(d.duree_secondes ?? 0)) || 0);
  return {
    titre: chaine(d.titre),
    titreCourt: chaine(d.titre_court),
    resume: chaine(d.resume),
    pointsCles: chaines(d.points_cles),
    lienVideo: estFournisseur(fournisseur) && id ? videoLink({ fournisseur, id }) : "",
    duree: minutesSecondes(duree),
    document: documentLu(d.document) ?? depuisMarkdown(chaine(d.texte)),
  };
}

const NIVEAUX = ["debutant", "intermediaire", "avance"] as const;

/** Les informations générales lues en base, rendues à l'éditeur. */
export function versSaisieInfos(brut: unknown): SaisieInfos {
  const d = (brut && typeof brut === "object" ? brut : {}) as Brut;
  const niveau = NIVEAUX.find((n) => n === d.niveau) ?? "debutant";
  return {
    titre: chaine(d.titre),
    resume: chaine(d.resume),
    description: chaine(d.description),
    objectifs: chaines(d.objectifs),
    competences: chaines(d.competences),
    niveau,
  };
}

/** Une réponse de `edition_lecon` ou `edition_formation`, dans la forme de l'éditeur. */
export function versEtatEdition<T>(brut: unknown, versDonnees: (d: unknown) => T): EtatEdition<T> {
  const e = (brut && typeof brut === "object" ? brut : {}) as Brut;
  return {
    donnees: versDonnees(e.donnees),
    revision: Number(e.revision ?? 0) || 0,
    brouillon: e.brouillon === true,
    enLigne: e.en_ligne === true,
    modifiePar: typeof e.modifie_par === "string" ? e.modifie_par : null,
    modifieLe: typeof e.modifie_le === "string" ? e.modifie_le : null,
  };
}
