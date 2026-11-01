"use client";

import { useRef, useState, type FormEvent } from "react";
import { Popover } from "radix-ui";
import {
  Image01Icon,
  InformationCircleIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  QuoteDownIcon,
  Redo02Icon,
  SolidLine01Icon,
  Table01Icon,
  TextBoldIcon,
  TextItalicIcon,
  TextStrikethroughIcon,
  TextUnderlineIcon,
  Undo02Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import { useEditorState, type Editor } from "@tiptap/react";
import { BoutonLien } from "@/components/communaute/EditeurTexte";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { TextInput } from "@/components/ui/TextInput";
import type { IconSvgElement } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";
import { parseVideoUrl } from "@/lib/admin/video";
import type { TonEncadre } from "@/lib/lecon/document";

// La barre d'outils de l'éditeur riche (fin du lot 4, spec §1.2), puis la barre du tableau ou du bloc d'information
// quand le curseur y est. Les boutons gardent la sélection du texte (mousedown sans effet).

type Bouton = { nom: string; icone: IconSvgElement; actif?: (e: Editor) => boolean; agir: (e: Editor) => void };

const MARQUES: Bouton[] = [
  { nom: "Gras", icone: TextBoldIcon, actif: (e) => e.isActive("bold"), agir: (e) => e.chain().focus().toggleBold().run() },
  { nom: "Italique", icone: TextItalicIcon, actif: (e) => e.isActive("italic"), agir: (e) => e.chain().focus().toggleItalic().run() },
  { nom: "Souligné", icone: TextUnderlineIcon, actif: (e) => e.isActive("underline"), agir: (e) => e.chain().focus().toggleUnderline().run() },
  { nom: "Barré", icone: TextStrikethroughIcon, actif: (e) => e.isActive("strike"), agir: (e) => e.chain().focus().toggleStrike().run() },
];
const BLOCS: Bouton[] = [
  { nom: "Liste à puces", icone: LeftToRightListBulletIcon, actif: (e) => e.isActive("bulletList"), agir: (e) => e.chain().focus().toggleBulletList().run() },
  { nom: "Liste numérotée", icone: LeftToRightListNumberIcon, actif: (e) => e.isActive("orderedList"), agir: (e) => e.chain().focus().toggleOrderedList().run() },
  { nom: "Citation", icone: QuoteDownIcon, actif: (e) => e.isActive("blockquote"), agir: (e) => e.chain().focus().toggleBlockquote().run() },
  { nom: "Bloc d’information", icone: InformationCircleIcon, actif: (e) => e.isActive("encadre"), agir: (e) => e.chain().focus().poserEncadre("info").run() },
];
const APRES: Bouton[] = [
  { nom: "Tableau", icone: Table01Icon, agir: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
];
const FIN: Bouton[] = [
  { nom: "Séparateur", icone: SolidLine01Icon, agir: (e) => e.chain().focus().setHorizontalRule().run() },
  { nom: "Annuler", icone: Undo02Icon, agir: (e) => e.chain().focus().undo().run() },
  { nom: "Rétablir", icone: Redo02Icon, agir: (e) => e.chain().focus().redo().run() },
];
const TONS: { ton: TonEncadre; nom: string }[] = [
  { ton: "info", nom: "Information" },
  { ton: "astuce", nom: "Astuce" },
  { ton: "attention", nom: "Attention" },
  { ton: "retenir", nom: "À retenir" },
];

const FENETRE = "z-50 rounded-carte border border-bordure-carte bg-panneau p-3 shadow-menu outline-none";
const ACTIF = "bg-bleu-clair text-bleu enabled:hover:bg-bleu-clair";
const SELECT =
  "focus-etudium h-8 rounded-puce border border-bordure-champ bg-panneau px-2 text-[13px] leading-5 text-encre outline-none disabled:opacity-50";
const Separation = () => <span aria-hidden className="mx-1 h-5 w-px flex-none bg-bordure-champ" />;

function Boutons({ editor, liste, etats }: { editor: Editor | null; liste: Bouton[]; etats: Record<string, boolean> }) {
  return liste.map((b) => (
    <IconButton
      key={b.nom}
      icon={b.icone}
      label={b.nom}
      aria-pressed={b.actif ? (etats[b.nom] ?? false) : undefined}
      variant="discret"
      size="sm"
      disabled={!editor}
      className={cn("flex-none", etats[b.nom] && ACTIF)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => editor && b.agir(editor)}
    />
  ));
}

/** « Vidéo » : un lien des plateformes acceptées devient une vidéo intégrée. */
function BoutonVideo({ editor }: { editor: Editor | null }) {
  const [ouvert, setOuvert] = useState(false);
  const [lien, setLien] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  function valider(e: FormEvent) {
    e.preventDefault();
    const video = parseVideoUrl(lien.trim());
    if (!editor || !video) {
      setErreur("Ce lien n’est pas une vidéo reconnue.");
      return;
    }
    editor.chain().focus().insertContent({ type: "videoLecon", attrs: { fournisseur: video.fournisseur, id: video.id } }).run();
    setOuvert(false);
  }
  return (
    <Popover.Root
      open={ouvert}
      onOpenChange={(o) => {
        setOuvert(o);
        if (o) {
          setLien("");
          setErreur(null);
        }
      }}
    >
      <Popover.Trigger asChild>
        <IconButton icon={Video01Icon} label="Vidéo" variant="discret" size="sm" disabled={!editor} className="flex-none" onMouseDown={(e) => e.preventDefault()} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} className={cn(FENETRE, "w-[360px] max-w-[calc(100vw_-_32px)]")}>
          <form className="flex flex-col gap-2" onSubmit={valider}>
            <TextInput
              aria-label="Lien de la vidéo"
              placeholder="https://youtu.be/…"
              inputMode="url"
              value={lien}
              onChange={(e) => setLien(e.target.value)}
              className="h-10 text-sm"
              autoCapitalize="none"
              spellCheck={false}
            />
            <p className="m-0 text-xs leading-[18px] text-discret">YouTube, Vimeo, TikTok, Tella, Loom, ScreenPal ou Google Drive.</p>
            {erreur && (
              <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
                {erreur}
              </p>
            )}
            <div className="flex justify-end">
              <Button type="submit" size="sm" aria-label="Insérer la vidéo">
                Insérer
              </Button>
            </div>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

type Props = {
  editor: Editor | null;
  /** Une image choisie sur l'appareil : l'éditeur l'envoie puis l'insère. */
  onImage: (fichier: File) => void;
  envoiEnCours: boolean;
};

export function BarreOutils({ editor, onImage, envoiEnCours }: Props) {
  const choix = useRef<HTMLInputElement>(null);
  const etat = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      actifs: Object.fromEntries([...MARQUES, ...BLOCS].map((b) => [b.nom, e ? (b.actif?.(e) ?? false) : false])),
      lien: e ? e.isActive("link") : false,
      style: e?.isActive("heading", { level: 2 }) ? "titre" : e?.isActive("heading", { level: 3 }) ? "sous-titre" : "texte",
      tableau: e ? e.isActive("table") : false,
      encadre: e ? e.isActive("encadre") : false,
      ton: (e?.getAttributes("encadre").ton as TonEncadre | undefined) ?? "info",
    }),
  });
  const actifs = etat?.actifs ?? {};
  const action = (agir: (e: Editor) => boolean) => () => editor && agir(editor);

  return (
    <div className="flex flex-col border-b border-bordure-champ">
      <div role="toolbar" aria-label="Mise en forme" className="flex items-center gap-0.5 overflow-x-auto px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <select
          aria-label="Style du paragraphe"
          className={cn(SELECT, "mr-1 flex-none")}
          disabled={!editor}
          value={etat?.style ?? "texte"}
          onChange={(e) => {
            if (!editor) return;
            const chaine = editor.chain().focus();
            if (e.target.value === "titre") chaine.setHeading({ level: 2 }).run();
            else if (e.target.value === "sous-titre") chaine.setHeading({ level: 3 }).run();
            else chaine.setParagraph().run();
          }}
        >
          <option value="texte">Texte</option>
          <option value="titre">Titre</option>
          <option value="sous-titre">Sous-titre</option>
        </select>
        <Separation />
        <Boutons editor={editor} liste={MARQUES} etats={actifs} />
        <span className="flex flex-none">
          <BoutonLien editor={editor} estActif={etat?.lien ?? false} />
        </span>
        <Separation />
        <Boutons editor={editor} liste={BLOCS} etats={actifs} />
        <IconButton
          icon={Image01Icon}
          label="Image"
          variant="discret"
          size="sm"
          disabled={!editor || envoiEnCours}
          className="flex-none"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => choix.current?.click()}
        />
        <Boutons editor={editor} liste={APRES} etats={actifs} />
        <span className="flex flex-none">
          <BoutonVideo editor={editor} />
        </span>
        <Boutons editor={editor} liste={FIN.slice(0, 1)} etats={actifs} />
        <Separation />
        <Boutons editor={editor} liste={FIN.slice(1)} etats={actifs} />
        <input
          ref={choix}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Choisir une image"
          tabIndex={-1}
          className="sr-only"
          onChange={(e) => {
            const fichier = e.target.files?.[0];
            e.target.value = "";
            if (fichier) onImage(fichier);
          }}
        />
      </div>

      {etat?.tableau && (
        <div role="toolbar" aria-label="Tableau" className="flex flex-wrap items-center gap-1.5 border-t border-bordure-champ bg-page px-2 py-1.5">
          <Button size="sm" variant="contour" onMouseDown={(e) => e.preventDefault()} onClick={action((e) => e.chain().focus().addRowAfter().run())}>
            Ajouter une ligne
          </Button>
          <Button size="sm" variant="contour" onMouseDown={(e) => e.preventDefault()} onClick={action((e) => e.chain().focus().addColumnAfter().run())}>
            Ajouter une colonne
          </Button>
          <Button size="sm" variant="contour" onMouseDown={(e) => e.preventDefault()} onClick={action((e) => e.chain().focus().deleteRow().run())}>
            Supprimer la ligne
          </Button>
          <Button size="sm" variant="contour" onMouseDown={(e) => e.preventDefault()} onClick={action((e) => e.chain().focus().deleteColumn().run())}>
            Supprimer la colonne
          </Button>
          <Button size="sm" variant="contour" onMouseDown={(e) => e.preventDefault()} onClick={action((e) => e.chain().focus().deleteTable().run())}>
            Supprimer le tableau
          </Button>
        </div>
      )}

      {etat?.encadre && (
        <div role="toolbar" aria-label="Bloc d’information" className="flex flex-wrap items-center gap-1.5 border-t border-bordure-champ bg-page px-2 py-1.5">
          <select
            aria-label="Ton du bloc"
            className={SELECT}
            value={etat.ton}
            onChange={(e) => editor?.chain().focus().changerTonEncadre(e.target.value as TonEncadre).run()}
          >
            {TONS.map((t) => (
              <option key={t.ton} value={t.ton}>
                {t.nom}
              </option>
            ))}
          </select>
          <Button size="sm" variant="contour" onMouseDown={(e) => e.preventDefault()} onClick={action((e) => e.chain().focus().retirerEncadre().run())}>
            Retirer le bloc
          </Button>
        </div>
      )}
    </div>
  );
}
