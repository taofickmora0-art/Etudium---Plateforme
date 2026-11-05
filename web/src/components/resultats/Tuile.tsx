import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Un chiffre clé (planche « Cartes », indicateurs) : son libellé nomme le groupe, pour les lecteurs d'écran. */
export function Tuile({ label, valeur, aide, className }: { label: string; valeur: ReactNode; aide?: ReactNode; className?: string }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn("box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[19px] pt-4 pb-3.5 max-sm:px-3.5 max-sm:pt-3 max-sm:pb-2.5", className)}>
      <span id={id} className="text-sm leading-5 text-discret max-sm:text-[13px]">
        {label}
      </span>
      <span className="mt-2 text-[26px] leading-8 font-medium tracking-[-0.01em] text-titre max-sm:mt-1 max-sm:text-[22px] max-sm:leading-7">{valeur}</span>
      {aide && <span className="mt-0.5 text-xs leading-[18px] text-discret">{aide}</span>}
    </div>
  );
}
