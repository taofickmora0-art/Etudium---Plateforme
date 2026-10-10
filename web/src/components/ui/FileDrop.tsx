"use client";

import { useRef, useState, type DragEvent } from "react";
import { Upload04Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import { IconTile } from "./IconTile";

type FileDropProps = {
  /** Types acceptés par le sélecteur du système (« .xlsx,.docx,.pdf »). */
  accept?: string;
  /** Formats et taille maximale, en clair (« Excel, Word ou PDF, 10 Mo maximum »). */
  maxSizeLabel: string;
  onFiles: (files: File[]) => void;
  title?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Zone de dépôt (planche « Formulaires », « Dépôt de fichier ») : glisser-déposer à la souris,
 * ou bouton « Choisir un fichier » au clavier et au doigt. Le contrôle du type et de la taille revient à l'appelant.
 */
export function FileDrop({ accept, maxSizeLabel, onFiles, title = "Déposez votre fichier ici", multiple, disabled, className }: FileDropProps) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex flex-col items-center gap-2 rounded-carte border-[1.5px] border-dashed border-inactif bg-page px-5 py-7 text-center transition-colors",
        over && "border-bleu bg-bleu-clair",
        disabled && "opacity-60",
        className,
      )}
    >
      <IconTile icon={Upload04Icon} size={44} tone="blanc" />
      <span className="text-[15px] leading-[22px] font-medium text-encre">{title}</span>
      <span className="text-[13px] leading-5 text-ardoise">{maxSizeLabel}</span>
      <Button variant="contour" size="sm" className="mt-1" disabled={disabled} onClick={() => input.current?.click()}>
        Choisir un fichier
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
