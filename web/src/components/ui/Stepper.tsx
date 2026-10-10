import { Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

type StepperProps = {
  steps: string[];
  /** Index (à partir de 0) de l'étape en cours ; les précédentes sont terminées. */
  current: number;
  /** Nom de la suite d'étapes pour les lecteurs d'écran (« Étapes de l’abonnement »). */
  label?: string;
  className?: string;
};

/** Étapes d'un parcours (abonnement…) : coche verte, numéro bleu pour l'étape en cours, gris pour la suite. */
export function Stepper({ steps, current, label = "Étapes", className }: StepperProps) {
  return (
    <ol aria-label={label} className={cn("m-0 flex list-none flex-wrap items-center gap-2.5 p-0", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex size-7 flex-none items-center justify-center rounded-full text-[13px] font-semibold",
                done && "bg-reussite-fond text-reussite-texte",
                active && "bg-bleu text-white",
                !done && !active && "bg-coque text-ardoise",
              )}
            >
              {done ? <Icon icon={Tick02Icon} size={16} /> : index + 1}
            </span>
            <span className={cn("text-sm leading-5", active ? "font-semibold text-encre" : "font-medium text-discret")}>
              {step}
              {done && <span className="sr-only"> (terminée)</span>}
            </span>
            {index < steps.length - 1 && <span aria-hidden="true" className="h-px w-7 bg-separateur" />}
          </li>
        );
      })}
    </ol>
  );
}
