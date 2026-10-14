import { useId } from "react";
import Link from "next/link";
import { Couverture } from "@/components/ui/Couverture";
import { ProgressBar } from "@/components/ui/Progress";
import { cn } from "@/lib/cn";
import type { VueCarteSuivie } from "./CarteSuivie";

const etatCourt = (vue: VueCarteSuivie) => (vue.etat === "verrouillee" ? vue.temps : vue.etat === "terminee" ? "Terminée" : `${Math.round(vue.pourcentage)} %`);

/**
 * Petite carte d'une formation suivie, pour la rangée « Mes formations » de la page Formations (spec Formations et
 * Événements, §2) : couverture, titre sur deux lignes, progression. Elle mène où reprendre ; sans adresse, ce n'est pas un lien.
 */
export function CarteSuivieCompacte({ vue }: { vue: VueCarteSuivie }) {
  const id = useId();
  const classes = "box-border flex h-full min-w-0 flex-col overflow-hidden rounded-carte border border-bordure-carte bg-panneau text-inherit no-underline";
  const contenu = (
    <>
      <Couverture src={vue.couverture} parcours={vue.parcours} sizes="(max-width: 640px) 136px, 220px" />
      <div className="flex min-w-0 flex-1 flex-col px-3 pt-2.5 pb-3">
        <h3 id={`${id}-titre`} title={vue.titre} className="m-0 line-clamp-2 min-h-10 text-sm leading-5 font-semibold text-encre">
          {vue.titre}
        </h3>
        <ProgressBar value={vue.pourcentage} label={`Progression de ${vue.titre}`} className="mt-2.5 h-1.5" />
        <span id={`${id}-etat`} className="mt-1.5 text-xs leading-[18px] text-discret">
          {etatCourt(vue)}
        </span>
      </div>
    </>
  );
  if (!vue.href) return <div className={classes}>{contenu}</div>;
  return (
    <Link
      href={vue.href}
      aria-labelledby={`${id}-titre`}
      aria-describedby={`${id}-etat`}
      className={cn(classes, "focus-etudium transition-colors hover:border-bordure-champ")}
    >
      {contenu}
    </Link>
  );
}
