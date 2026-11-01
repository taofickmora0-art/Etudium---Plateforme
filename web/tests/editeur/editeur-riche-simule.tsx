import { texteDuDocument, type DocumentLecon } from "@/lib/lecon/document";

// L'éditeur riche remplacé par une zone de texte dans les tests des écrans : jsdom ne sait pas simuler sa sélection.
// Mêmes nom et propriétés que `EditeurRiche` ; chaque ligne devient un paragraphe. L'éditeur réel a ses propres tests.
export function EditeurRiche({
  valeur,
  onChange,
  onBlur,
  etiquette,
  placeholder,
}: {
  formationId: string;
  valeur: DocumentLecon;
  images: Record<string, string>;
  onChange: (doc: DocumentLecon) => void;
  onBlur?: () => void;
  etiquette: string;
  placeholder: string;
}) {
  return (
    <textarea
      aria-label={etiquette}
      placeholder={placeholder}
      value={texteDuDocument(valeur)}
      onBlur={onBlur}
      onChange={(e) =>
        onChange({
          type: "doc",
          content: e.target.value.split("\n").map((ligne) => (ligne ? { type: "paragraph", content: [{ type: "text", text: ligne }] } : { type: "paragraph" })),
        })
      }
    />
  );
}
