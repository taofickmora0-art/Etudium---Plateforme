// « Ajouter à mon agenda » (spec, §4) : un fichier .ics que lisent Google Agenda, Outlook et les téléphones. Le lien
// du live n'est pas encore connu à l'inscription : l'événement renvoie à la page Événements.

type SessionAgenda = { id: string; titre: string; description: string; debut: string; dureeMinutes: number };

/** « 20261024T140000Z » : l'instant en UTC. */
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Texte d'un champ iCalendar : \ ; , échappés, retours à la ligne en \n. */
const echapper = (texte: string) => texte.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

export function fichierIcs(s: SessionAgenda, adresse: string, maintenant: Date): string {
  const debut = new Date(s.debut);
  const fin = new Date(debut.getTime() + s.dureeMinutes * 60_000);
  const description = s.description.trim() ? `${s.description.trim()}\n\n${adresse}` : adresse;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Etudium//Sessions live//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${s.id}@etudium`,
    `DTSTAMP:${utc(maintenant)}`,
    `DTSTART:${utc(debut)}`,
    `DTEND:${utc(fin)}`,
    `SUMMARY:${echapper(s.titre)}`,
    `DESCRIPTION:${echapper(description)}`,
    `URL:${adresse}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
