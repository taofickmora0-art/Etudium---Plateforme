// Les notes vocales (migration 0076, spec du 4 novembre 2026) : les règles communes au navigateur et au serveur. La base
// revérifie tout (note_vocale_valide, formats_vocaux).

/** Une note trop courte (un appui par erreur) n'est pas envoyée ; au bout de 5 minutes, l'enregistrement s'arrête. */
export const DUREE_MIN_MS = 1_000;
export const DUREE_MAX_MS = 300_000;
/** 10 Mo : la limite des espaces « messages » et « groupes » pour une note. */
export const VOCAL_MAX_OCTETS = 10_485_760;
/** Les barres de l'onde dessinée dans la bulle (la base en accepte 64). */
export const BARRES = 48;

/**
 * Ce que l'on demande à MediaRecorder, dans l'ordre : MP4/AAC (Safari, Chrome et Edge récents ; lisible partout, iPhone
 * compris), puis WebM ou Ogg/Opus (Firefox, Chrome plus ancien).
 */
const FORMATS = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/webm"];

/** Le premier format que le navigateur sait enregistrer ; null s'il n'en sait aucun. */
export function choisirFormat(estAccepte: (type: string) => boolean): string | null {
  return FORMATS.find((f) => estAccepte(f)) ?? null;
}

/** « audio/webm;codecs=opus » → « audio/webm » : le type déposé (l'espace de fichiers compare le type sans paramètres). */
export const typeDeBase = (type: string) => type.split(";")[0].trim().toLowerCase();

const EXTENSIONS: Record<string, string> = { "audio/mp4": "m4a", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/aac": "aac" };

/** L'extension du fichier déposé ; null pour un type que la base refuserait. */
export const extensionVocale = (type: string): string | null => EXTENSIONS[typeDeBase(type)] ?? null;

/** « 0:07 », « 1:42 », « 5:00 », à la seconde la plus proche. */
export function dureeLisible(ms: number): string {
  const secondes = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;
}

/** « Note vocale (0:12) » : la liste, la réponse citée, l'épingle. */
export const libelleVocal = (ms: number | null) => (ms === null ? "Note vocale" : `Note vocale (${dureeLisible(ms)})`);

/**
 * Les niveaux mesurés pendant l'enregistrement (un toutes les 100 ms environ) ramenés à `barres` barres, de 0 à 100 :
 * la moyenne de chaque tranche, la plus haute à 100. Moins de mesures que de barres : une barre par mesure.
 */
export function resumerOnde(niveaux: number[], barres = BARRES): number[] {
  const propres = niveaux.map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  if (propres.length === 0) return [];
  const nombre = Math.min(barres, propres.length);
  const moyennes = Array.from({ length: nombre }, (_, i) => {
    const debut = Math.floor((i * propres.length) / nombre);
    const fin = Math.max(debut + 1, Math.floor(((i + 1) * propres.length) / nombre));
    const tranche = propres.slice(debut, fin);
    return tranche.reduce((s, n) => s + n, 0) / tranche.length;
  });
  const max = Math.max(...moyennes);
  return max > 0 ? moyennes.map((m) => Math.min(100, Math.round((m / max) * 100))) : moyennes.map(() => 0);
}

/** Une note vocale lue dans la base : sa durée (ms) et son onde (0 à 100). */
export type NoteVocale = { dureeMs: number; ondes: number[] };

/** L'onde rendue par la base : 64 barres au plus, chacune ramenée entre 0 et 100 (0 pour ce qui n'est pas un nombre). */
export const versOnde = (v: unknown): number[] =>
  (Array.isArray(v) ? v : []).slice(0, 64).map((n) => (typeof n === "number" && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0));

/** Une durée rendue par la base ; null si ce n'est pas une note vocale. */
export const versDuree = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null);

/** « vocal » rendu par la base (duree_ms, ondes) ; null sans note vocale. */
export function versNoteVocale(v: unknown): NoteVocale | null {
  if (!v || typeof v !== "object") return null;
  const l = v as Record<string, unknown>;
  const dureeMs = versDuree(l.duree_ms);
  return dureeMs === null ? null : { dureeMs, ondes: versOnde(l.ondes) };
}
