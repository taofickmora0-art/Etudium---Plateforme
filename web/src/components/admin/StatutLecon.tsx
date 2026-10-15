"use client";

import { ArrowDown01Icon, CheckmarkCircle02Icon, PencilEdit02Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { Menu } from "@/components/ui/Menu";
import { cn } from "@/lib/cn";

/**
 * Le statut d'une leçon (refonte des formations, spec §3.3) : « Publiée ▾ » en vert, « Brouillon ▾ » en gris ; le menu
 * propose l'autre statut. Les étudiants ne voient que les leçons publiées.
 */
export function StatutLecon({ publiee, onChange, desactive = false, className }: { publiee: boolean; onChange: (publiee: boolean) => void; desactive?: boolean; className?: string }) {
  const libelle = publiee ? "Publiée" : "Brouillon";
  return (
    <Menu
      label="Statut de la leçon"
      trigger={
        <button
          type="button"
          aria-label={`Statut : ${libelle}`}
          disabled={desactive}
          className={cn(
            "focus-etudium inline-flex h-8 flex-none cursor-pointer items-center gap-1 rounded-puce px-2.5 text-[13px] leading-5 font-semibold transition-colors disabled:cursor-default disabled:opacity-60 max-sm:h-7 max-sm:px-2 max-sm:text-xs",
            publiee ? "bg-reussite-fond text-reussite-texte hover:brightness-95" : "bg-fond-doux text-ardoise-fonce hover:bg-coque",
            className,
          )}
        >
          {libelle}
          <Icon icon={ArrowDown01Icon} size={14} />
        </button>
      }
      items={[
        publiee
          ? { label: "Mettre en brouillon", icon: PencilEdit02Icon, onSelect: () => onChange(false) }
          : { label: "Publier", icon: CheckmarkCircle02Icon, onSelect: () => onChange(true) },
      ]}
    />
  );
}
