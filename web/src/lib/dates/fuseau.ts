// Les fuseaux horaires (liste du 31 octobre 2026, tâche 10). Une heure est fixée une fois pour toutes (en UTC dans la
// base) ; chacun la lit à l'heure de son appareil. Le Bénin (UTC+1 toute l'année) reste le fuseau par défaut : celui du
// rendu serveur et des textes écrits par la base.

export const FUSEAU_BENIN = "Africa/Porto-Novo";

/** Un nom de fuseau que le navigateur et le serveur connaissent (« Africa/Lome »). */
export function fuseauValide(fuseau: unknown): fuseau is string {
  if (typeof fuseau !== "string" || fuseau.length === 0 || fuseau.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: fuseau });
    return true;
  } catch {
    return false;
  }
}

const caches = new Map<string, Intl.DateTimeFormat>();
/** Un format mis de côté par fuseau et par usage : les construire coûte cher. */
export function formatDe(cle: string, fuseau: string, options: Intl.DateTimeFormatOptions, langue = "fr-FR"): Intl.DateTimeFormat {
  const nom = `${cle}|${fuseau}|${langue}`;
  let format = caches.get(nom);
  if (!format) {
    format = new Intl.DateTimeFormat(langue, { ...options, timeZone: fuseau });
    caches.set(nom, format);
  }
  return format;
}

/** « GMT+1 » au Bénin, « GMT » au Togo, « GMT+5:30 » en Inde, à ce moment-là (l'heure d'été compte). */
export function decalageGmt(iso: string, fuseau = FUSEAU_BENIN): string {
  const parties = formatDe("decalage", fuseau, { timeZoneName: "shortOffset" }, "en-US").formatToParts(new Date(iso));
  const valeur = parties.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  // Node écrit « GMT+0 » là où les navigateurs écrivent « GMT ».
  return /^GMT[+-]0$/.test(valeur) ? "GMT" : valeur;
}

/** L'écart, en minutes, entre l'heure du fuseau et l'UTC à cet instant (+60 au Bénin). */
export function decalageMinutes(instant: number, fuseau: string): number {
  const parties = formatDe(
    "parties",
    fuseau,
    { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" },
    "en-US",
  ).formatToParts(new Date(instant));
  const v = (type: string) => Number(parties.find((p) => p.type === type)?.value ?? 0);
  const commeUtc = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"), v("second"));
  return Math.round((commeUtc - Math.floor(instant / 1000) * 1000) / 60_000);
}
