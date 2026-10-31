// Saisie d'une date et d'une heure (champs du 31 octobre 2026) : le texte tapé ou affiché (« 24/10/2026 », « 15:00 »)
// et la valeur échangée avec les formulaires (« 2026-10-24 », « 15:00 »). Les dates sont des jours du calendrier, sans
// fuseau : les calculs se font en temps universel pour qu'aucun décalage horaire ne change de jour.

const deux = (n: number) => String(n).padStart(2, "0");

/** Un jour qui existe vraiment (pas le 31 février). */
function jourValide(annee: number, mois: number, jour: number): boolean {
  if (annee < 1900 || annee > 2999 || mois < 1 || mois > 12 || jour < 1) return false;
  return jour <= new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** « 24/10/2026 » ou « 2026-10-24 » (une date collée) → « 2026-10-24 » ; null si ce n'est pas une date. */
export function isoDepuisTexte(texte: string): string | null {
  const t = texte.trim();
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t);
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  const [annee, mois, jour] = fr ? [Number(fr[3]), Number(fr[2]), Number(fr[1])] : iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : [0, 0, 0];
  return jourValide(annee, mois, jour) ? `${annee}-${deux(mois)}-${deux(jour)}` : null;
}

/** « 2026-10-24 » → « 24/10/2026 » ; une valeur vide reste vide. */
export function texteDepuisIso(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** « 15:00 », « 9:30 », « 9h30 » → « 09:30 » ; null si ce n'est pas une heure. */
export function heureDepuisTexte(texte: string): string | null {
  const m = /^(\d{1,2})\s*[:hH]\s*(\d{2})$/.exec(texte.trim());
  if (!m) return null;
  const [heures, minutes] = [Number(m[1]), Number(m[2])];
  return heures <= 23 && minutes <= 59 ? `${deux(heures)}:${deux(minutes)}` : null;
}

/** Un jour du calendrier (« 2026-10-24 ») en date universelle, et l'inverse. */
export const dateUtc = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const isoUtc = (date: Date) => `${date.getUTCFullYear()}-${deux(date.getUTCMonth() + 1)}-${deux(date.getUTCDate())}`;

/** Le jour décalé de `jours`. */
export const decaler = (iso: string, jours: number) => isoUtc(new Date(dateUtc(iso).getTime() + jours * 86_400_000));

/** Aujourd'hui, sur l'appareil. */
export function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

/** Le premier jour du mois de `iso`, décalé de `mois` mois. */
export function premierDuMois(iso: string, mois = 0): string {
  const d = dateUtc(iso);
  return isoUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mois, 1)));
}

/**
 * Les semaines du mois de `premier` (du lundi au dimanche), avec les jours des mois voisins pour compléter : autant de
 * semaines qu'il en faut (4 à 6).
 */
export function semainesDuMois(premier: string): string[][] {
  const debut = dateUtc(premier);
  const decalage = (debut.getUTCDay() + 6) % 7;
  const jours = new Date(Date.UTC(debut.getUTCFullYear(), debut.getUTCMonth() + 1, 0)).getUTCDate();
  const nombre = Math.ceil((decalage + jours) / 7);
  return Array.from({ length: nombre }, (_, s) => Array.from({ length: 7 }, (_, j) => decaler(premier, s * 7 + j - decalage)));
}

const MOIS = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** « Octobre 2026 ». */
export function titreMois(premier: string): string {
  const texte = MOIS.format(dateUtc(premier));
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** « samedi 24 octobre 2026 » : le nom d'un jour pour les lecteurs d'écran. */
export const nomDuJour = (iso: string) => JOUR.format(dateUtc(iso));
