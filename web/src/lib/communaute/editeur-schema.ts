import { Blockquote } from "@tiptap/extension-blockquote";
import { Heading } from "@tiptap/extension-heading";
import { Link } from "@tiptap/extension-link";
import { ListItem } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { adresseDeLien } from "./mise-en-forme";

// Le schéma de l'éditeur visuel (spec mise en forme et vidéo, §1 et §2) : il ne crée que ce que le texte enregistré sait
// ranger, pour que la publication s'affiche comme dans l'éditeur. Un élément de liste est un seul paragraphe (pas de
// sous-liste : Tab ne fait rien), une citation ne contient que des paragraphes, un titre est une seule ligne de texte.

const ElementDeListe = ListItem.extend({
  content: "paragraph",
  addKeyboardShortcuts() {
    return { Enter: () => this.editor.commands.splitListItem(this.name), "Shift-Tab": () => this.editor.commands.liftListItem(this.name) };
  },
});
const Citation = Blockquote.extend({ content: "paragraph+" });
// Maj+Entrée (ou Ctrl+Entrée) dans un titre ne fait rien : un titre reste une seule ligne. Passe avant le saut de ligne.
const Titre = Heading.extend({
  content: "text*",
  priority: 1000,
  addKeyboardShortcuts() {
    const dansUnTitre = () => this.editor.isActive(this.name);
    return { ...this.parent?.(), "Shift-Enter": dansUnTitre, "Mod-Enter": dansUnTitre };
  },
}).configure({ levels: [1, 2, 3] });
// Un texte rendu cliquable : http ou https seulement, ouvert dans un nouvel onglet ; seul le bouton « Lien » en crée un.
// Une adresse collée reste du texte (Tiptap la changerait en lien même sans `linkOnPaste`, d'où les règles retirées).
const Lien = Link.extend({ addPasteRules: () => [] }).configure({
  openOnClick: false,
  autolink: false,
  linkOnPaste: false,
  isAllowedUri: (adresse) => adresseDeLien(adresse),
  HTMLAttributes: { target: "_blank", rel: "noopener nofollow ugc" },
});

/** Les extensions de l'éditeur ; `placeholder` : le texte indicatif quand il est vide. */
export function extensionsEditeur(placeholder = "") {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      listItem: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      // Un paragraphe vide ajouté en fin de document n'est pas enregistré : rien à ajouter.
      trailingNode: false,
    }),
    Titre,
    Lien,
    Citation,
    ElementDeListe,
    Placeholder.configure({ placeholder }),
  ];
}
