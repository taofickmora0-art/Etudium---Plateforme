import { Delete02Icon, Download04Icon, File02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { IconButton, iconButtonVariants } from "./IconButton";
import { ProgressBar } from "./Progress";

type FileRowProps = {
  name: string;
  /** Taille et contexte (« 248 Ko · envoyé à l’instant »). */
  meta: string;
  /** Pendant l'envoi (0 à 100) : la ligne affiche « Envoi… 62 % » et une barre. */
  progress?: number;
  /** Bouton corbeille « Retirer le fichier ». */
  onRemove?: () => void;
  /** Lien « Télécharger » (ressource d'une leçon, reçu). */
  downloadHref?: string;
  className?: string;
};

const ROW = "rounded-bouton border border-bordure-carte px-3.5 py-3";

/** Un fichier déposé ou téléchargeable ; un nom trop long est coupé avec « … ». */
export function FileRow({ name, meta, progress, onRemove, downloadHref, className }: FileRowProps) {
  if (progress !== undefined) {
    const pct = Math.round(progress);
    return (
      <div className={cn(ROW, "flex min-w-0 flex-col gap-2", className)}>
        <div className="flex items-center justify-between gap-3">
          <span title={name} className="min-w-0 truncate text-sm leading-5 font-medium text-encre">
            {name}
          </span>
          <span className="flex-none text-xs leading-[18px] text-discret">Envoi… {pct} %</span>
        </div>
        <ProgressBar value={pct} label={`Envoi de ${name}`} />
      </div>
    );
  }

  return (
    <div className={cn(ROW, "flex min-w-0 items-center gap-3", className)}>
      <span className="flex size-10 flex-none items-center justify-center rounded-champ bg-coque text-texte">
        <Icon icon={File02Icon} size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span title={name} className="truncate text-sm leading-5 font-medium text-encre">
          {name}
        </span>
        <span className="text-xs leading-[18px] text-discret">{meta}</span>
      </span>
      {downloadHref && (
        <a href={downloadHref} download aria-label={`Télécharger ${name}`} className={iconButtonVariants({ variant: "discret", size: "sm" })}>
          <Icon icon={Download04Icon} size={16} />
        </a>
      )}
      {onRemove && <IconButton icon={Delete02Icon} label={`Retirer ${name}`} variant="discret" size="sm" onClick={onRemove} />}
    </div>
  );
}
