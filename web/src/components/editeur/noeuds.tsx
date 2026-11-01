"use client";

import { createContext, useContext } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { LecteurVideo } from "@/components/lecon/LecteurVideo";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { FOURNISSEURS, type Fournisseur } from "@/lib/video/plateformes";

// Les vues de l'image et de la vidéo dans l'éditeur riche (fin du lot 4, spec §1.2) : l'image avec son lien signé, son
// texte alternatif et sa légende ; la vidéo avec le lecteur officiel. Chacune se retire d'un clic.

/** Le lien signé de chaque image du document, fourni par l'éditeur. */
export const ContexteImages = createContext<Record<string, string>>({});

export function VueImage({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const liens = useContext(ContexteImages);
  const chemin = String(node.attrs.chemin ?? "");
  const url = liens[chemin];
  return (
    <NodeViewWrapper
      as="figure"
      contentEditable={false}
      data-drag-handle=""
      className={`m-0 flex flex-col gap-2 rounded-carte border p-2.5 ${selected ? "border-bleu shadow-focus" : "border-bordure-carte"}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- image privée, servie par un lien signé d'une heure
        <img src={url} alt={String(node.attrs.alt ?? "")} className="block h-auto max-h-[420px] max-w-full self-start rounded-champ" />
      ) : (
        <div className="flex h-28 items-center justify-center rounded-champ border border-dashed border-bordure-champ bg-page text-sm text-discret">Image indisponible</div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <TextInput
          aria-label="Texte alternatif"
          placeholder="Texte alternatif (lu aux personnes malvoyantes)"
          maxLength={200}
          value={String(node.attrs.alt ?? "")}
          onChange={(e) => updateAttributes({ alt: e.target.value })}
          className="h-9 text-[13px]"
        />
        <TextInput
          aria-label="Légende"
          placeholder="Légende (facultative)"
          maxLength={300}
          value={String(node.attrs.legende ?? "")}
          onChange={(e) => updateAttributes({ legende: e.target.value })}
          className="h-9 text-[13px]"
        />
      </div>
      <Button variant="contour" size="sm" className="self-end" onClick={deleteNode}>
        Retirer l’image
      </Button>
    </NodeViewWrapper>
  );
}

export function VueVideo({ node, deleteNode, selected }: NodeViewProps) {
  const fournisseur = node.attrs.fournisseur as Fournisseur;
  const id = String(node.attrs.id ?? "");
  return (
    <NodeViewWrapper
      contentEditable={false}
      data-drag-handle=""
      className={`flex flex-col gap-2 rounded-carte border p-2.5 ${selected ? "border-bleu shadow-focus" : "border-bordure-carte"}`}
    >
      {FOURNISSEURS.includes(fournisseur) && id ? (
        <LecteurVideo video={{ fournisseur, id }} titre="vidéo intégrée" />
      ) : (
        <p className="m-0 text-sm text-discret">Vidéo non reconnue.</p>
      )}
      <Button variant="contour" size="sm" className="self-end" onClick={deleteNode}>
        Retirer la vidéo
      </Button>
    </NodeViewWrapper>
  );
}
