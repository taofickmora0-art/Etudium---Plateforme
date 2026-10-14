"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Popover } from "radix-ui";
import {
  Heading01Icon,
  Heading02Icon,
  Heading03Icon,
  LeftToRightListBulletIcon,
  Link01Icon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
  SmileIcon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
} from "@hugeicons/core-free-icons";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import type { IconSvgElement } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { extensionsEditeur } from "@/lib/communaute/editeur-schema";
import { adresseDeLien, versDocument, versMarkdown } from "@/lib/communaute/mise-en-forme";
import { EMOJIS } from "./emojis";

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

const ADRESSE_INVALIDE = "Collez une adresse complète (https://…).";
const FENETRE = "z-50 rounded-carte border border-bordure-carte bg-panneau p-3 shadow-menu outline-none";
const actif = "bg-bleu-clair text-bleu enabled:hover:bg-bleu-clair";

/** « Lien » : le texte sélectionné devient cliquable (http ou https) ; sans sélection, l'adresse est insérée comme lien. */
function BoutonLien({ editor, estActif }: { editor: Editor | null; estActif: boolean }) {
  const [ouvert, setOuvert] = useState(false);
  const [adresse, setAdresse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);

  function ouvrir(o: boolean) {
    setOuvert(o);
    if (o) {
      setAdresse(editor?.getAttributes("link").href ?? "");
      setErreur(null);
    }
  }

  function valider(e: FormEvent) {
    e.preventDefault();
    const href = adresse.trim();
    if (!editor || !adresseDeLien(href)) {
      setErreur(ADRESSE_INVALIDE);
      return;
    }
    if (editor.state.selection.empty && !editor.isActive("link")) {
      editor.chain().focus().insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] }).run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setOuvert(false);
  }

  return (
    <Popover.Root open={ouvert} onOpenChange={ouvrir}>
      <Popover.Trigger asChild>
        <IconButton
          icon={Link01Icon}
          label="Lien"
          aria-pressed={estActif}
          variant="discret"
          size="sm"
          disabled={!editor}
          className={cn(estActif && actif)}
          onMouseDown={(e) => e.preventDefault()}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(FENETRE, "w-[340px] max-w-[calc(100vw_-_32px)]")}>
          <form className="flex flex-col gap-2" onSubmit={valider}>
            <TextInput aria-label="Adresse du lien" placeholder="https://…" inputMode="url" value={adresse} onChange={(e) => setAdresse(e.target.value)} className="h-10 text-sm" />
            {erreur && (
              <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
                {erreur}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {estActif && (
                <Button
                  variant="contour"
                  size="sm"
                  onClick={() => {
                    editor?.chain().focus().extendMarkRange("link").unsetLink().run();
                    setOuvert(false);
                  }}
                >
                  Retirer le lien
                </Button>
              )}
              <Button type="submit" size="sm" aria-label="Valider le lien">
                Valider
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** « Emoji » : une grille d'emojis courants ; un clic insère l'emoji à la place du curseur. */
function BoutonEmoji({ editor }: { editor: Editor | null }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <Popover.Root open={ouvert} onOpenChange={setOuvert}>
      <Popover.Trigger asChild>
        <IconButton icon={SmileIcon} label="Emoji" variant="discret" size="sm" disabled={!editor} onMouseDown={(e) => e.preventDefault()} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={6} className={cn(FENETRE, "w-[296px] max-w-[calc(100vw_-_32px)] p-2")}>
          <div role="group" aria-label="Emojis" className="grid grid-cols-8 gap-0.5">
            {EMOJIS.map(([emoji, nom]) => (
              <button
                key={nom}
                type="button"
                aria-label={nom}
                title={nom}
                className="focus-etudium flex size-8 items-center justify-center rounded-puce text-lg leading-none transition-colors hover:bg-coque"
                onClick={() => {
                  editor?.chain().focus().insertContent(emoji).run();
                  setOuvert(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function BarreMiseEnForme({ editor }: { editor: Editor | null }) {
  const etats = useEditorState({ editor, selector: ({ editor: e }) => [...BOUTONS.map((b) => (e ? b.actif(e) : false)), e ? e.isActive("link") : false] });
  const actifs = etats ?? BOUTONS.map(() => false);
  const lienActif = etats?.[BOUTONS.length] ?? false;
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
            className={cn(actifs[i] && actif)}
            // La sélection du texte reste en place quand on clique un bouton.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor && b.agir(editor)}
          />
        </span>
      ))}
      <span aria-hidden className="mx-1 h-5 w-px flex-none bg-bordure-champ" />
      <span className="flex flex-none items-center gap-0.5">
        <BoutonLien editor={editor} estActif={lienActif} />
        <BoutonEmoji editor={editor} />
      </span>
    </div>
  );
}

/**
 * L'éditeur visuel d'une publication (spec mise en forme et vidéo, §1 ; communauté v3, §1) : la barre « Mise en forme »
 * (titres 1 à 3, gras, italique, souligné, barré, listes, citation, lien, emoji) et le texte, montré comme il paraîtra. `valeur` et `onChange` portent le
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
