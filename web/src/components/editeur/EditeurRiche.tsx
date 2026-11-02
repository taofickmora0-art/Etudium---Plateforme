"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { cn } from "@/lib/cn";
import { imagesAColler } from "@/lib/editeur/collage";
import { envoyerImage, liensImages } from "@/lib/editeur/envoi-image";
import { extensionsLecon } from "@/lib/editeur/extensions";
import type { DocumentLecon } from "@/lib/lecon/document";
import { BarreOutils } from "./BarreOutils";
import { ContexteImages, VueImage, VueVideo } from "./noeuds";

// L'éditeur riche d'une leçon (fin du lot 4, spec §1.2) : la barre d'outils, puis le contenu montré comme l'étudiant le
// verra (DocumentLecon). La barre reste en haut : seul le contenu défile.

const CONTENU = cn(
  "tiptap min-h-[220px] px-4 py-3.5 text-[15px] leading-6 text-texte outline-none wrap-anywhere max-sm:px-3 max-sm:text-sm max-sm:leading-[22px]",
  "[&>*+*]:mt-3! [&_p]:m-0 [&_strong]:font-semibold [&_u]:underline-offset-2",
  "[&_a]:text-bleu [&_a]:underline [&_a]:underline-offset-2",
  "[&_h2]:m-0 [&_h2]:text-xl [&_h2]:leading-7 [&_h2]:font-semibold [&_h2]:text-encre",
  "[&_h3]:m-0 [&_h3]:text-[17px] [&_h3]:leading-6 [&_h3]:font-semibold [&_h3]:text-encre",
  "[&_ul]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:m-0 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_blockquote]:m-0 [&_blockquote]:border-l-[3px] [&_blockquote]:border-bleu-bord [&_blockquote]:pl-3 [&_blockquote]:text-ardoise",
  "[&_[data-encadre]]:rounded-carte [&_[data-encadre]]:px-4 [&_[data-encadre]]:py-3 [&_[data-encadre]>*+*]:mt-2!",
  "[&_[data-encadre=info]]:bg-bleu-pale [&_[data-encadre=astuce]]:bg-reussite-fond [&_[data-encadre=attention]]:bg-attention-fond [&_[data-encadre=retenir]]:bg-premium-fond",
  "[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_.tableWrapper]:overflow-x-auto",
  "[&_td]:border [&_td]:border-bordure-carte [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_th]:border [&_th]:border-bordure-carte [&_th]:bg-bleu-clair [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold",
  "[&_.selectedCell]:bg-bleu-pale [&_hr]:my-2 [&_hr]:h-px [&_hr]:border-0 [&_hr]:bg-separateur",
);

type Props = {
  formationId: string;
  valeur: DocumentLecon;
  /** Le lien signé de chaque image déjà dans le document. */
  images: Record<string, string>;
  /** Appelé à chaque modification, jamais à l'ouverture. */
  onChange: (doc: DocumentLecon) => void;
  onBlur?: () => void;
  etiquette: string;
  placeholder: string;
};

export function EditeurRiche({ formationId, valeur, images, onChange, onBlur, etiquette, placeholder }: Props) {
  // Les images envoyées depuis l'ouverture, ajoutées à celles du document ; les liens de la page (re-signés) d'abord.
  const [envoyees, setEnvoyees] = useState<Record<string, string>>({});
  const liens = useMemo(() => liensImages(images, envoyees), [images, envoyees]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // Le dernier document émis : une valeur égale vient de l'éditeur lui-même et ne le recharge pas.
  const emis = useRef(JSON.stringify(valeur));
  // Le dernier document émis lui-même : sa valeur revient telle quelle, sans la resérialiser (gros documents).
  const emisObjet = useRef<unknown>(null);
  const rappels = useRef({ onChange, onBlur });
  useEffect(() => {
    rappels.current = { onChange, onBlur };
  });
  const envoyer = useRef<(f: File) => void>(() => {});

  const extensions = useMemo(
    () => extensionsLecon(placeholder, { image: ReactNodeViewRenderer(VueImage), video: ReactNodeViewRenderer(VueVideo) }),
    [placeholder],
  );
  const editor = useEditor({
    extensions,
    content: valeur,
    immediatelyRender: false,
    editorProps: {
      attributes: { role: "textbox", "aria-multiline": "true", "aria-label": etiquette, class: CONTENU },
      // Une image collée ou déposée part dans l'espace des images ; jamais en `data:` dans le document.
      // Un tableau d'Excel ou de Word arrive avec une image de ses cellules : c'est le tableau qui entre.
      handlePaste: (_vue, evenement) => {
        const fichiers = imagesAColler(evenement.clipboardData);
        fichiers.forEach((f) => envoyer.current(f));
        return fichiers.length > 0;
      },
      handleDrop: (_vue, evenement) => {
        const fichiers = [...((evenement as DragEvent).dataTransfer?.files ?? [])].filter((f) => f.type.startsWith("image/"));
        fichiers.forEach((f) => envoyer.current(f));
        return fichiers.length > 0;
      },
    },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as DocumentLecon;
      emis.current = JSON.stringify(doc);
      emisObjet.current = doc;
      rappels.current.onChange(doc);
    },
    onBlur: () => rappels.current.onBlur?.(),
  });

  useEffect(() => {
    envoyer.current = async (fichier: File) => {
      setErreur(null);
      setEnvoiEnCours(true);
      const r = await envoyerImage(formationId, fichier);
      setEnvoiEnCours(false);
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      setEnvoyees((avant) => ({ ...avant, [r.chemin]: r.url }));
      editor?.chain().focus().insertContent({ type: "imageLecon", attrs: { chemin: r.chemin, alt: "", legende: "" } }).run();
    };
  }, [editor, formationId]);

  // Une valeur changée de l'extérieur (récupération d'une copie, restauration) remplace le contenu, sans émettre.
  useEffect(() => {
    if (!editor || valeur === emisObjet.current) return;
    const json = JSON.stringify(valeur);
    if (json === emis.current) return;
    emis.current = json;
    editor.commands.setContent(valeur, { emitUpdate: false });
  }, [editor, valeur]);

  return (
    <div className="box-border flex min-w-0 flex-col rounded-champ border border-bordure-champ bg-panneau transition-[border-color,box-shadow] focus-within:border-bleu focus-within:shadow-focus">
      <BarreOutils editor={editor} onImage={(f) => envoyer.current(f)} envoiEnCours={envoiEnCours} />
      {envoiEnCours && (
        <p role="status" className="m-0 border-b border-bordure-champ bg-page px-3 py-1.5 text-[13px] leading-5 text-discret">
          Envoi de l’image…
        </p>
      )}
      {erreur && (
        <p role="alert" className="m-0 border-b border-bordure-champ bg-erreur-fond px-3 py-1.5 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      <ContexteImages.Provider value={liens}>
        <div className="max-h-[70vh] min-w-0 overflow-y-auto">
          <EditorContent editor={editor} />
        </div>
      </ContexteImages.Provider>
    </div>
  );
}
