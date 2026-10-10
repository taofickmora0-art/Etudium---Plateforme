import { Clock01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type ProgressBarProps = {
  /** Pourcentage de 0 à 100. */
  value: number;
  /** Nom annoncé de la barre (« Progression », « Progression de Maîtriser Microsoft Excel »). */
  label?: string;
  className?: string;
};

/** Barre de 8 px : piste #D6DDEC, remplissage bleu Étudium (planche « Boutons », « Avatars et progression »). */
export function ProgressBar({ value, label = "Progression", className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 overflow-hidden rounded-full bg-piste", className)}
    >
      <div className="h-full rounded-full bg-bleu transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** La ligne sous la barre : « 68 % terminé · 2 h restantes ». */
export function ProgressMeta({ value, timeLabel, className }: { value: number; timeLabel?: string; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-[7px] text-xs leading-[18px] text-discret", className)}>
      <span>{Math.round(value)} % terminé</span>
      {timeLabel && (
        <>
          <span aria-hidden="true" className="size-[3px] rounded-full bg-discret" />
          <span className="flex items-center gap-1">
            <Icon icon={Clock01Icon} size={18} className="-mx-[1.5px]" />
            <span>{timeLabel}</span>
          </span>
        </>
      )}
    </div>
  );
}
