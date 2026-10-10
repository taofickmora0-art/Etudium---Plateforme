import { cn } from "@/lib/cn";
import { ProgressBar } from "./Progress";

/** Progression d'une tâche (envoi, génération du certificat…) : barre puis « Envoi du fichier… 62 % ». */
export function TaskProgress({ label, value, className }: { label: string; value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("w-full", className)}>
      <ProgressBar value={pct} label={label.replace(/…$/, "")} />
      <div aria-hidden="true" className="mt-2 flex justify-between text-xs leading-[18px] text-discret">
        <span>{label}</span>
        <span>{pct} %</span>
      </div>
    </div>
  );
}
