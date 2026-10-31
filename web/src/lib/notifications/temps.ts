import { formatDe } from "@/lib/dates/fuseau";
import { dateCourte } from "@/lib/utilisateurs/regles";

// Le temps des notifications, à l'heure du Bénin (UTC+1 toute l'année) : « Il y a 5 min », « Hier », groupes par jour.
// `maintenant` est toujours passé : les fonctions restent pures et testables.

const FUSEAU = "Africa/Porto-Novo";
// « 2026-10-14 » : la date du jour au Bénin, pour comparer deux jours.
const JOUR = new Intl.DateTimeFormat("en-CA", { timeZone: FUSEAU, year: "numeric", month: "2-digit", day: "2-digit" });
const HEURE = new Intl.DateTimeFormat("fr-FR", { timeZone: FUSEAU, hour: "numeric", minute: "2-digit", hourCycle: "h23" });
const UN_JOUR = 86_400_000;

const jourBenin = (date: Date) => JOUR.format(date);

/** « Aujourd’hui », « Hier », sinon la date (« 12 oct. 2026 »). */
export function libelleJour(iso: string, maintenant: Date): string {
  const jour = jourBenin(new Date(iso));
  if (jour === jourBenin(maintenant)) return "Aujourd’hui";
  if (jour === jourBenin(new Date(maintenant.getTime() - UN_JOUR))) return "Hier";
  return dateCourte(iso);
}

/** « À l’instant », « Il y a 5 min », « Il y a 2 h » le jour même ; sinon « Hier » ou la date. */
export function quand(iso: string, maintenant: Date): string {
  const date = new Date(iso);
  const minutes = Math.floor((maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "À l’instant";
  if (jourBenin(date) === jourBenin(maintenant)) return minutes < 60 ? `Il y a ${minutes} min` : `Il y a ${Math.floor(minutes / 60)} h`;
  return libelleJour(iso, maintenant);
}

/** « 14 h 05 », « 9 h 05 » ; à l'heure du Bénin, ou du fuseau donné (sessions live, tâche 10). */
export function heure(iso: string, fuseau = FUSEAU): string {
  const format = fuseau === FUSEAU ? HEURE : formatDe("heure", fuseau, { hour: "numeric", minute: "2-digit", hourCycle: "h23" });
  const parties = format.formatToParts(new Date(iso));
  const valeur = (type: string) => parties.find((p) => p.type === type)?.value ?? "";
  return `${Number(valeur("hour"))} h ${valeur("minute")}`;
}

/** Un groupe par jour (« Aujourd’hui », « Hier », « 12 oct. 2026 »), dans l'ordre reçu. */
export function grouperParJour<T extends { creeLe: string }>(lignes: T[], maintenant: Date): { cle: string; libelle: string; lignes: T[] }[] {
  const groupes: { cle: string; libelle: string; lignes: T[] }[] = [];
  for (const ligne of lignes) {
    const cle = jourBenin(new Date(ligne.creeLe));
    const dernier = groupes.at(-1);
    if (dernier?.cle === cle) dernier.lignes.push(ligne);
    else groupes.push({ cle, libelle: libelleJour(ligne.creeLe, maintenant), lignes: [ligne] });
  }
  return groupes;
}
