// La fenêtre « Désactiver cette formation ? » (lot 5, étape C ; spec du 15 octobre, Q13) : le nombre d'étudiants
// concernés, puis ce qui va se passer. null : le nombre n'a pas pu être lu (migration 0059 absente, base injoignable).

export function texteDesactivation(suiveurs: number | null): string {
  const suite = "Vous pourrez la réactiver.";
  if (suiveurs === null) return `L’accès des étudiants qui la suivent sera suspendu tout de suite ; ils seront prévenus. ${suite}`;
  if (suiveurs === 0) return `Aucun étudiant ne suit cette formation. Elle disparaîtra du catalogue tout de suite. ${suite}`;
  if (suiveurs === 1) return `1 étudiant suit cette formation. Son accès sera suspendu tout de suite ; il sera prévenu. ${suite}`;
  return `${suiveurs} étudiants suivent cette formation. Leur accès sera suspendu tout de suite ; ils seront prévenus. ${suite}`;
}
