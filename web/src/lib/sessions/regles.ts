import { decalageGmt, decalageMinutes, formatDe, FUSEAU_BENIN, fuseauValide } from "@/lib/dates/fuseau";
import { heure } from "@/lib/notifications/temps";
import type { DonneesSession } from "./types";

// Règles des sessions live (spec, §1 et §2). Les dates s'écrivent dans un fuseau (`fuseau`) : celui de l'appareil de
// chacun à l'écran (tâche 10 du 31 octobre 2026), le Bénin (UTC+1 toute l'année) par défaut. Les mêmes limites et les
// mêmes messages que la base (migration 0018), qui revérifie tout.

const JOUR_ISO = (f: string) => formatDe("jour-iso", f, { year: "numeric", month: "2-digit", day: "2-digit" }, "en-CA");
const HEURE_CHAMP = (f: string) => formatDe("heure-champ", f, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const MOIS_COURT = (f: string) => formatDe("mois-court", f, { month: "short" });
const JOUR_DU_MOIS = (f: string) => formatDe("jour-du-mois", f, { day: "numeric" });
const JOUR_LONG = (f: string) => formatDe("jour-long", f, { weekday: "long", day: "numeric", month: "long" });

/** La base livre le lien 10 min avant le début ; « Rejoindre » ne l'ouvre qu'à l'heure du début (tâche 10). */
export const FENETRE_LIEN_MIN = 10;
/** De 30 min à 4 h, par quarts d'heure. */
export const DUREES = Array.from({ length: 15 }, (_, i) => 30 + i * 15);
export const DUREE_PAR_DEFAUT = 60;
export const TITRE_MAX = 120;
export const DESCRIPTION_MAX = 1000;
const LIEN_MAX = 500;
const UN_JOUR = 86_400_000;

export const REFUS = {
  titre: "Écrivez un titre (120 caractères au plus).",
  description: "La description dépasse 1 000 caractères.",
  date: "Choisissez une date au moins 10 minutes dans le futur.",
  annee: "Choisissez une date dans l’année qui vient.",
  duree: "Choisissez une durée de 30 minutes à 4 heures, par quarts d’heure.",
  lien: "Le lien doit commencer par https://",
} as const;

/** « 30 min », « 1 h », « 1 h 15 », « 4 h ». */
export function dureeLisible(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** Le bloc du jour de la carte : « OCT. » et « 24 ». */
export function jourCarte(iso: string, fuseau = FUSEAU_BENIN): { mois: string; jour: string } {
  const date = new Date(iso);
  return { mois: MOIS_COURT(fuseau).format(date).toLocaleUpperCase("fr-FR"), jour: JOUR_DU_MOIS(fuseau).format(date) };
}

const jourEtMois = (iso: string, fuseau: string) => JOUR_LONG(fuseau).format(new Date(iso));

/** « Samedi 24 octobre · 15 h 00 ». */
export function dateSession(iso: string, fuseau = FUSEAU_BENIN): string {
  const jour = jourEtMois(iso, fuseau);
  return `${jour.charAt(0).toLocaleUpperCase("fr-FR")}${jour.slice(1)} · ${heure(iso, fuseau)}`;
}

/** « samedi 24 octobre à 15 h 00 », au milieu d'une phrase. */
export const phraseSession = (iso: string, fuseau = FUSEAU_BENIN) => `${jourEtMois(iso, fuseau)} à ${heure(iso, fuseau)}`;

export type FormeQuand = "date" | "phrase" | "heure";

/**
 * Le moment d'une session avec son décalage GMT, pour qu'on sache de quelle heure il s'agit d'un pays à l'autre :
 * « Samedi 24 octobre · 15 h 00 (GMT+1) », « samedi 24 octobre à 15 h 00 (GMT+1) », « 15 h 00 (GMT+1) ».
 */
export function quandSession(iso: string, fuseau = FUSEAU_BENIN, forme: FormeQuand = "date"): string {
  const texte = forme === "phrase" ? phraseSession(iso, fuseau) : forme === "heure" ? heure(iso, fuseau) : dateSession(iso, fuseau);
  return `${texte} (${decalageGmt(iso, fuseau)})`;
}

const jourDans = (date: Date, fuseau: string) => Date.parse(`${JOUR_ISO(fuseau).format(date)}T00:00:00Z`);

/** « Aujourd’hui », « Demain », « Dans 2 jours », au jour du fuseau. */
export function dansJours(iso: string, maintenant: Date, fuseau = FUSEAU_BENIN): string {
  const jours = Math.round((jourDans(new Date(iso), fuseau) - jourDans(maintenant, fuseau)) / UN_JOUR);
  if (jours <= 0) return "Aujourd’hui";
  return jours === 1 ? "Demain" : `Dans ${jours} jours`;
}

/** Le temps qui reste avant le début : « 45 min », « 2 h 15 », « 1 jour et 4 h », « 3 jours » (« Rejoindre » trop tôt). */
export function commenceDans(debut: string, maintenant: Date): string {
  const reste = Date.parse(debut) - maintenant.getTime();
  if (reste < 60_000) return "moins d’une minute";
  const minutes = Math.ceil(reste / 60_000);
  if (minutes < 24 * 60) return dureeLisible(minutes);
  const jours = Math.floor(minutes / (24 * 60));
  const heures = Math.floor((minutes % (24 * 60)) / 60);
  const libelle = `${jours} jour${jours > 1 ? "s" : ""}`;
  return heures > 0 && jours < 2 ? `${libelle} et ${heures} h` : libelle;
}

type Moment = { debut: string; dureeMinutes: number };
export const finSession = (s: Moment) => new Date(Date.parse(s.debut) + s.dureeMinutes * 60_000);
export const enCours = (s: Moment, maintenant: Date) => Date.parse(s.debut) <= maintenant.getTime() && maintenant < finSession(s);
export const terminee = (s: Moment, maintenant: Date) => maintenant >= finSession(s);

/**
 * Date et heure du formulaire, lues dans le fuseau du formateur (le Bénin par défaut) → début ISO avec son décalage
 * (« 2026-10-24T15:00:00+01:00 ») ; null si incomplet ou impossible.
 */
export function debutDepuis(date: string, heureChamp: string, fuseau = FUSEAU_BENIN): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(heureChamp)) return null;
  const [a, m, j] = date.split("-").map(Number);
  const [h, mi] = heureChamp.split(":").map(Number);
  if (h > 23 || mi > 59) return null;
  const mur = Date.UTC(a, m - 1, j, h, mi);
  if (Number.isNaN(mur) || new Date(mur).getUTCDate() !== j) return null;
  // Deux passes : le décalage du fuseau à cette heure-là (l'heure d'été peut changer entre les deux).
  const decalage = decalageMinutes(mur - decalageMinutes(mur, fuseau) * 60_000, fuseau);
  const signe = decalage < 0 ? "-" : "+";
  const absolu = Math.abs(decalage);
  return `${date}T${heureChamp}:00${signe}${String(Math.floor(absolu / 60)).padStart(2, "0")}:${String(absolu % 60).padStart(2, "0")}`;
}

/** Début ISO → champs du formulaire, dans le fuseau du formateur (le Bénin par défaut). */
export function champsDepuis(iso: string, fuseau = FUSEAU_BENIN): { date: string; heure: string } {
  const date = new Date(iso);
  return { date: JOUR_ISO(fuseau).format(date), heure: HEURE_CHAMP(fuseau).format(date) };
}

/**
 * Ce qui empêche d'enregistrer une session, ou null. En modification, `verifierDebut: false` laisse la base juger le
 * début : elle ne le revérifie que s'il change (une session en cours se modifie encore, pour corriger son lien).
 */
export function refusSession(d: DonneesSession, maintenant: Date, options: { verifierDebut?: boolean } = {}): string | null {
  const titre = (d.titre ?? "").trim();
  if (titre.length === 0 || titre.length > TITRE_MAX) return REFUS.titre;
  if ((d.description ?? "").trim().length > DESCRIPTION_MAX) return REFUS.description;
  const debut = debutDepuis(d.date, d.heure, fuseauValide(d.fuseau) ? d.fuseau : FUSEAU_BENIN);
  if (!debut) return REFUS.date;
  if (options.verifierDebut !== false) {
    if (Date.parse(debut) < maintenant.getTime() + 10 * 60_000) return REFUS.date;
    if (Date.parse(debut) > maintenant.getTime() + 365 * UN_JOUR) return REFUS.annee;
  }
  if (!DUREES.includes(d.dureeMinutes)) return REFUS.duree;
  const lien = (d.lien ?? "").trim();
  if (!lien.startsWith("https://") || lien.length > LIEN_MAX || /\s/.test(lien)) return REFUS.lien;
  return null;
}

/** La plateforme d'après le lien du live, comme la base (plateforme_session) : « Google Meet », « Zoom » ou « En ligne ». */
export function plateformeDepuisLien(lien: string): string {
  const adresse = lien.trim();
  if (/^https:\/\/meet\.google\.com(\/|$)/i.test(adresse)) return "Google Meet";
  if (/^https:\/\/([a-z0-9-]+\.)*zoom\.us(\/|$)/i.test(adresse)) return "Zoom";
  return "En ligne";
}

/** « 1 inscription », « 128 inscriptions » : neutre. */
export const libelleInscriptions = (n: number) => `${n.toLocaleString("fr-FR")} inscription${n > 1 ? "s" : ""}`;
