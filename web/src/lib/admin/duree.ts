// Durée d'une leçon, saisie et affichée comme dans le design : « 12:40 », « 06:10 », « 1:02:03 ».

/** « 12:40 » → 760 ; « 1:02:03 » → 3723 ; « 45 » (minutes seules) → 2700 ; vide → 0 ; saisie invalide → null. */
export function parseDuree(saisie: string): number | null {
  const texte = saisie.trim();
  if (texte === "") return 0;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(texte)) return null;
  const parties = texte.split(":").map(Number);
  if (parties.length === 1) return parties[0] * 60;
  if (parties.slice(1).some((p) => p >= 60)) return null;
  return parties.reduce((total, p) => total * 60 + p, 0);
}

const deuxChiffres = (n: number) => String(n).padStart(2, "0");

/** 760 → « 12:40 » ; 3723 → « 1:02:03 » ; 0 → « ». */
export function formatDuree(secondes: number): string {
  if (!secondes) return "";
  const heures = Math.floor(secondes / 3600);
  const minutes = Math.floor((secondes % 3600) / 60);
  const reste = secondes % 60;
  return heures > 0 ? `${heures}:${deuxChiffres(minutes)}:${deuxChiffres(reste)}` : `${deuxChiffres(minutes)}:${deuxChiffres(reste)}`;
}
