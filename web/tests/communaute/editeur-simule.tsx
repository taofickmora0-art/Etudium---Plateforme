// L'éditeur visuel remplacé par une zone de texte dans les tests des écrans : jsdom ne sait pas simuler sa sélection.
// Même nom, mêmes propriétés que `EditeurTexte` ; l'éditeur réel a ses propres tests (editeur.test.tsx).
export function EditeurTexte({
  valeur,
  onChange,
  etiquette,
  placeholder,
  autoFocus,
}: {
  valeur: string;
  onChange: (texte: string) => void;
  etiquette: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return <textarea aria-label={etiquette} placeholder={placeholder} value={valeur} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />;
}
