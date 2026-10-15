/** « 15 octobre 2026 », depuis le jour de délivrance « 2026-10-15 ». */
export function dateLongue(jour: string): string {
  const date = new Date(`${jour}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? jour : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}
