// « Ajouter à mon agenda » (spec des sessions live, §4 ; spec Formations et Événements, §3.1) : Google Agenda par défaut,
// et un fichier .ics pour les autres agendas (Apple, Outlook). Le lien du live n'est pas encore connu à l'inscription :
// l'événement renvoie à la page Événements.

type SessionAgenda = { id: string; titre: string; description: string; debut: string; dureeMinutes: number };

/** « 20261024T140000Z » : l'instant en UTC. */
const utc = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Texte d'un champ iCalendar : \ ; , échappés, retours à la ligne en \n. */
const echapper = (texte: string) => texte.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

const bornes = (s: SessionAgenda) => {
  const debut = new Date(s.debut);
  return { debut, fin: new Date(debut.getTime() + s.dureeMinutes * 60_000) };
};

const descriptionAgenda = (s: SessionAgenda, adresse: string) => (s.description.trim() ? `${s.description.trim()}\n\n${adresse}` : adresse);

/**
 * L'adresse qui ouvre Google Agenda sur l'événement pré-rempli. Elle ne porte que la session (titre, heures, description,
 * page Événements) ; Google y applique le rappel par défaut de l'agenda de la personne.
 */
export function lienGoogleAgenda(s: SessionAgenda, adresse: string): string {
  const { debut, fin } = bornes(s);
  const parametres = new URLSearchParams({
    action: "TEMPLATE",
    text: s.titre,
    dates: `${utc(debut)}/${utc(fin)}`,
    details: descriptionAgenda(s, adresse),
    location: adresse,
  });
  return `https://calendar.google.com/calendar/render?${parametres.toString()}`;
}

/** Le fichier .ics, avec une alerte 10 min avant (Apple Calendar, Outlook). */
export function fichierIcs(s: SessionAgenda, adresse: string, maintenant: Date): string {
  const { debut, fin } = bornes(s);
  const description = descriptionAgenda(s, adresse);
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
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${echapper(s.titre)}`,
    "TRIGGER:-PT10M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
