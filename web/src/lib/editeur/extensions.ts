import { mergeAttributes, Node, type NodeViewRenderer } from "@tiptap/react";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Heading } from "@tiptap/extension-heading";
import { Link } from "@tiptap/extension-link";
import { ListItem } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { adresseDeLien } from "@/lib/communaute/mise-en-forme";
import { TONS_ENCADRE, type TonEncadre } from "@/lib/lecon/document";

// Le schéma de l'éditeur riche des leçons (fin du lot 4, spec §1.2). Il ne crée que ce que le format accepte
// (lib/lecon/document.ts) : ce que l'éditeur montre est ce qui sera enregistré. Un collage venu d'une page (image,
// couleur, bloc de code) ne garde que le texte et les marques connues. Les vues des nœuds (image, vidéo) sont fournies
// par l'interface (EditeurRiche).

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    encadre: {
      /** Met le bloc courant dans un encadré (ou en insère un vide). */
      poserEncadre: (ton: TonEncadre) => ReturnType;
      changerTonEncadre: (ton: TonEncadre) => ReturnType;
      retirerEncadre: () => ReturnType;
    };
  }
}

/** Le bloc d'information : quatre tons, des paragraphes et des listes. */
export const Encadre = Node.create({
  name: "encadre",
  group: "block",
  content: "(paragraph | bulletList | orderedList)+",
  defining: true,
  addAttributes() {
    return {
      ton: {
        default: "info",
        parseHTML: (el) => {
          const ton = el.getAttribute("data-encadre");
          return TONS_ENCADRE.includes(ton as TonEncadre) ? ton : "info";
        },
        renderHTML: (a) => ({ "data-encadre": a.ton }),
      },
    };
  },
  parseHTML: () => [{ tag: "div[data-encadre]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", mergeAttributes(HTMLAttributes, { role: "note" }), 0],
  addCommands() {
    return {
      poserEncadre:
        (ton) =>
        ({ commands }) =>
          commands.wrapIn(this.name, { ton }) || commands.insertContent({ type: this.name, attrs: { ton }, content: [{ type: "paragraph" }] }),
      changerTonEncadre:
        (ton) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, { ton }),
      retirerEncadre:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
});

/** Une image de l'espace `images_lecons` : son chemin (jamais une adresse), un texte alternatif et une légende. */
export const ImageLecon = Node.create({
  name: "imageLecon",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      chemin: { default: "", parseHTML: (el) => el.getAttribute("data-chemin") ?? "", renderHTML: (a) => ({ "data-chemin": a.chemin }) },
      alt: { default: "", parseHTML: (el) => el.getAttribute("data-alt") ?? "", renderHTML: (a) => ({ "data-alt": a.alt }) },
      legende: { default: "", parseHTML: (el) => el.getAttribute("data-legende") ?? "", renderHTML: (a) => ({ "data-legende": a.legende }) },
    };
  },
  // Seule une image copiée depuis l'éditeur lui-même revient : une image collée depuis une page est ignorée.
  parseHTML: () => [{ tag: "figure[data-chemin]" }],
  renderHTML: ({ HTMLAttributes }) => ["figure", HTMLAttributes],
});

/** Une vidéo intégrée (plateformes acceptées) : fournisseur et identifiant, jamais le lien collé. */
export const VideoLecon = Node.create({
  name: "videoLecon",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      fournisseur: { default: "", parseHTML: (el) => el.getAttribute("data-fournisseur") ?? "", renderHTML: (a) => ({ "data-fournisseur": a.fournisseur }) },
      id: { default: "", parseHTML: (el) => el.getAttribute("data-video") ?? "", renderHTML: (a) => ({ "data-video": a.id }) },
    };
  },
  parseHTML: () => [{ tag: "div[data-video]" }],
  renderHTML: ({ HTMLAttributes }) => ["div", HTMLAttributes],
});

const ElementDeListe = ListItem.extend({ content: "paragraph+" });
const Citation = Blockquote.extend({ content: "paragraph+" });
// Un titre est une seule ligne de texte : Maj+Entrée (ou Ctrl+Entrée) n'y ajoute pas de saut.
const Titre = Heading.extend({
  content: "text*",
  priority: 1000,
  addKeyboardShortcuts() {
    const dansUnTitre = () => this.editor.isActive(this.name);
    return { ...this.parent?.(), "Shift-Enter": dansUnTitre, "Mod-Enter": dansUnTitre };
  },
}).configure({ levels: [2, 3] });
const Lien = Link.extend({ addPasteRules: () => [] }).configure({
  openOnClick: false,
  autolink: false,
  linkOnPaste: false,
  isAllowedUri: (adresse) => adresseDeLien(adresse),
  HTMLAttributes: { target: "_blank", rel: "noopener nofollow ugc" },
});
// Une cellule ne contient que des paragraphes ; pas de largeur de colonne enregistrée.
const Cellule = TableCell.extend({ content: "paragraph+" });
const CelluleEnTete = TableHeader.extend({ content: "paragraph+" });

export type VuesNoeuds = { image?: NodeViewRenderer; video?: NodeViewRenderer };

/** Les extensions de l'éditeur riche ; `vues` : les vues React de l'image et de la vidéo (absentes : rendu HTML simple). */
export function extensionsLecon(placeholder: string, vues: VuesNoeuds = {}) {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      listItem: false,
      code: false,
      codeBlock: false,
      link: false,
      trailingNode: false,
    }),
    Titre,
    Lien,
    Citation,
    ElementDeListe,
    Encadre,
    vues.image ? ImageLecon.extend({ addNodeView: () => vues.image! }) : ImageLecon,
    vues.video ? VideoLecon.extend({ addNodeView: () => vues.video! }) : VideoLecon,
    Table.configure({ resizable: false }),
    TableRow,
    CelluleEnTete,
    Cellule,
    Placeholder.configure({ placeholder }),
  ];
}
