import type { ReactNode } from "react";
import { Alert02Icon, AlertCircleIcon, CheckmarkCircle02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

// Planche « Messages », « Bandeaux dans la page » : fond clair de l'état, icône foncée du même état.
const TONES = {
  attention: { box: "bg-attention-fond", icon: "text-attention-texte", glyph: Alert02Icon },
  information: { box: "bg-bleu-pale", icon: "text-bleu", glyph: InformationCircleIcon },
  reussite: { box: "bg-reussite-fond", icon: "text-reussite-texte", glyph: CheckmarkCircle02Icon },
  erreur: { box: "bg-erreur-fond", icon: "text-erreur-texte", glyph: AlertCircleIcon },
} as const;

type BannerProps = {
  tone: keyof typeof TONES;
  /** Début en gras (« Le paiement n’a pas abouti. »). */
  title?: ReactNode;
  children?: ReactNode;
  /** Bouton ou lien à droite (« Réessayer », « Voir ma formule »). */
  action?: ReactNode;
  className?: string;
};

/** Bandeau dans la page. Une erreur est une alerte (lue tout de suite), les autres tons sont des messages d'état. */
export function Banner({ tone, title, children, action, className }: BannerProps) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "erreur" ? "alert" : "status"}
      // Plus compacte sur téléphone (comme le reste de l'appli).
      className={cn("flex flex-wrap items-center gap-3 rounded-carte px-4 py-3.5 max-sm:gap-2.5 max-sm:px-3 max-sm:py-2.5", t.box, className)}
    >
      <span className={cn("flex-none", t.icon)}>
        <Icon icon={t.glyph} size={22} className="max-sm:size-5" />
      </span>
      <span className="min-w-0 flex-[1_1_240px] text-sm leading-[22px] text-encre max-sm:text-[13px] max-sm:leading-5">
        {title && <strong className="font-semibold">{title}</strong>}
        {title && children && " "}
        {children}
      </span>
      {action}
    </div>
  );
}
