import { ProgressBar } from "@/components/ui/Progress";
import { ETOILES, formatNote, libelleNombreAvis, pourcentages } from "@/lib/avis/regles";
import type { ResumeAvis } from "@/lib/avis/types";
import { cn } from "@/lib/cn";
import { EtoilesNote } from "./EtoilesNote";

/**
 * Synthèse des avis (annexe 1.3 §5.4 publique, §6 c connectée) : moyenne, nombre d'avis, puis une barre par note,
 * de 5 à 1, avec sa part en %.
 */
export function SyntheseAvis({ resume, variante }: { resume: ResumeAvis; variante: "public" | "connecte" }) {
  const parts = pourcentages(resume);
  const publique = variante === "public";
  const moyenne = resume.moyenne ?? 0;
  return (
    <div className={cn("flex flex-col", publique ? "gap-2" : "gap-3.5")}>
      {publique ? (
        <div className="mb-1.5 flex items-baseline gap-2.5">
          <span className="text-[56px] leading-[60px] font-medium tracking-[-0.04em] text-bleu">{formatNote(moyenne)}</span>
          <span className="text-sm leading-[22px] text-discret">{libelleNombreAvis(resume.total)}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3.5">
          <span className="text-[32px] leading-10 font-medium tracking-[-0.01em] text-titre">{formatNote(moyenne)}</span>
          <span className="flex flex-col gap-0.5">
            <EtoilesNote note={moyenne} taille={16} />
            <span className="text-[13px] leading-5 text-discret">{libelleNombreAvis(resume.total)}</span>
          </span>
        </div>
      )}
      <div className={cn("flex flex-col", publique ? "gap-2" : "gap-1.5")}>
        {ETOILES.map((n) => (
          <div key={n} className="flex items-center gap-2.5">
            <span className={cn("flex-none text-center text-[13px] leading-5 text-texte", publique ? "w-2.5" : "w-2.5 font-medium")}>{n}</span>
            <ProgressBar value={parts[n]} label={n > 1 ? `${n} étoiles` : "1 étoile"} className={cn("flex-1", publique ? "h-2" : "h-1.5")} />
            <span className={cn("flex-none text-right text-discret", publique ? "w-9 text-[13px] leading-5" : "w-[38px] text-xs leading-[18px]")}>{`${parts[n]} %`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
