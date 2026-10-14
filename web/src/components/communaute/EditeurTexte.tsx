"use client";

import { useEffect, useRef } from "react";
import {
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@hugeicons/core-free-icons";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { IconButton } from "@/components/ui/IconButton";
import type { IconSvgElement } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { extensionsEditeur } from "@/lib/communaute/editeur-schema";
import { versDocument, versMarkdown } from "@/lib/communaute/mise-en-forme";

type Bouton = { nom: string; icone: IconSvgElement; actif: (e: Editor) => boolean; agir: (e: Editor) => void; groupe: number };

const BOUTONS: Bouton[] = [
  { nom: "Titre 1", icone: Heading01Icon, groupe: 0, actif: (e) => e.isActive("heading", { level: 1 }), agir: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { nom: "Titre 2", icone: Heading02Icon, groupe: 0, actif: (e) => e.isActive("heading", { level: 2 }), agir: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { nom: "Titre 3", icone: Heading03Icon, groupe: 0, actif: (e) => e.isActive("heading", { level: 3 }), agir: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { nom: "Gras", icone: TextBoldIcon, groupe: 1, actif: (e) => e.isActive("bold"), agir: (e) => e.chain().focus().toggleBold().run() },
  { nom: "Italique", icone: TextItalicIcon, groupe: 1, actif: (e) => e.isActive("italic"), agir: (e) => e.chain().focus().toggleItalic().run() },
  { nom: "Souligné", icone: TextUnderlineIcon, groupe: 1, actif: (e) => e.isActive("underline"), agir: (e) => e.chain().focus().toggleUnderline().run() },
  { nom: "Barré", icone: TextStrikethroughIcon, groupe: 1, actif: (e) => e.isActive("strike"), agir: (e) => e.chain().focus().toggleStrike().run() },
  { nom: "Liste à puces", icone: LeftToRightListBulletIcon, groupe: 2, actif: (e) => e.isActive("bulletList"), agir: (e) => e.chain().focus().toggleBulletList().run() },
  { nom: "Liste numérotée", icone: LeftToRightListNumberIcon, groupe: 2, actif: (e) => e.isActive("orderedList"), agir: (e) => e.chain().focus().toggleOrderedList().run() },
  { nom: "Citation", icone: QuoteDownIcon, groupe: 2, actif: (e) => e.isActive("blockquote"), agir: (e) => e.chain().focus().toggleBlockquote().run() },
];

// L'éditeur montre la mise en forme comme la carte la montrera (TexteMisEnForme).
const CONTENU = cn(
  "tiptap min-h-[104px] max-h-[420px] overflow-y-auto px-3.5 py-3 text-[15px] leading-[22px] text-texte outline-none wrap-anywhere max-sm:text-sm",
  "[&>*+*]:mt-2.5 [&_p]:m-0 [&_strong]:font-semibold [&_u]:underline-offset-2",
  "[&_h1]:m-0 [&_h1]:text-xl [&_h1]:leading-7 [&_h1]:font-semibold [&_h1]:text-encre",
  "[&_h2]:m-0 [&_h2]:text-lg [&_h2]:leading-[26px] [&_h2]:font-semibold [&_h2]:text-encre",
  "[&_h3]:m-0 [&_h3]:text-base [&_h3]:leading-6 [&_h3]:font-semibold [&_h3]:text-encre",
  "[&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_blockquote]:m-0 [&_blockquote]:border-l-[3px] [&_blockquote]:border-bleu-bord [&_blockquote]:pl-3 [&_blockquote]:text-ardoise",
);

function BarreMiseEnForme({ editor }: { editor: Editor | null }) {
  const actifs = useEditorState({ editor, selector: ({ editor: e }) => BOUTONS.map((b) => (e ? b.actif(e) : false)) }) ?? BOUTONS.map(() => false);
  return (
    <div
      role="toolbar"
      aria-label="Mise en forme"
      className="flex items-center gap-0.5 overflow-x-auto border-b border-bordure-champ px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {BOUTONS.map((b, i) => (
        <span key={b.nom} className="flex flex-none items-center">
          {i > 0 && BOUTONS[i - 1].groupe !== b.groupe && <span aria-hidden className="mx-1 h-5 w-px bg-bordure-champ" />}
          <IconButton
            icon={b.icone}
            label={b.nom}
            aria-pressed={actifs[i]}
            variant="discret"
            size="sm"
            disabled={!editor}
            className={cn(actifs[i] && "bg-bleu-clair text-bleu enabled:hover:bg-bleu-clair")}
            // La sélection du texte reste en place quand on clique un bouton.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && b.agir(editor)}
          />
        </span>
      ))}
    </div>
  );
}

/**
 * L'éditeur visuel d'une publication (spec mise en forme et vidéo, §1) : la barre « Mise en forme » (titres 1 à 3, gras,
 * italique, souligné, barré, listes, citation) et le texte, montré comme il paraîtra. `valeur` et `onChange` portent le
 * texte enregistré (Markdown restreint) ; une valeur changée de l'extérieur (vidée après Publier) remplace le contenu.
 */
export function EditeurTexte({
  valeur,
  onChange,
  etiquette,
  placeholder,
  autoFocus = false,
  className,
}: {
  valeur: string;
  onChange: (texte: string) => void;
  etiquette: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}) {
  // Le dernier texte émis : une valeur égale vient de l'éditeur lui-même et ne le recharge pas.
  const emis = useRef(valeur);
  const surChangement = useRef(onChange);
  useEffect(() => {
    surChangement.current = onChange;
  });
  const editor = useEditor({
    extensions: extensionsEditeur(placeholder),
    content: versDocument(valeur),
    immediatelyRender: false,
    autofocus: autoFocus ? "end" : false,
    editorProps: { attributes: { role: "textbox", "aria-multiline": "true", "aria-label": etiquette, class: CONTENU } },
    onUpdate: ({ editor: e }) => {
      const texte = versMarkdown(e.getJSON());
      emis.current = texte;
      surChangement.current(texte);
    },
  });

  useEffect(() => {
    if (!editor || valeur === emis.current) return;
    emis.current = valeur;
    editor.commands.setContent(versDocument(valeur), { emitUpdate: false });
  }, [editor, valeur]);

  return (
    <div
      className={cn(
        "box-border min-w-0 rounded-champ border border-bordure-champ bg-panneau transition-[border-color,box-shadow] focus-within:border-bleu focus-within:shadow-focus",
        className,
      )}
    >
      <BarreMiseEnForme editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
