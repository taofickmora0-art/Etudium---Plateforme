import type { ReactNode } from "react";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

// Planche « Boutons », « Étiquettes » : fond clair + texte foncé du même état, rayon 4.
const TONES = {
  nouveau: "bg-bleu-pale text-bleu",
  gratuit: "bg-reussite-fond text-reussite-texte",
  populaire: "bg-attention-fond text-attention-texte",
  complementaire: "bg-premium-fond text-premium-texte",
  verrouillee: "bg-fond-doux text-ardoise-fonce",
  valide: "bg-reussite-fond text-reussite-texte",
  aCorriger: "bg-attention-fond text-attention-texte",
  enAttente: "bg-fond-doux text-ardoise-fonce",
  echoue: "bg-erreur-fond text-erreur-texte",
  reussi: "bg-reussite-fond text-reussite-texte",
  compteur: "bg-bleu-pale text-bleu",
  academique: "bg-bleu-pale text-bleu",
  digital: "bg-premium-fond text-premium-texte",
  business: "bg-[#FFEDD9] text-business-texte",
} as const;

export type TagTone = keyof typeof TONES;

type TagProps = { tone: TagTone; icon?: IconSvgElement; className?: string; children: ReactNode };

export function Tag({ tone, icon, className, children }: TagProps) {
  const leading = icon ?? (tone === "verrouillee" ? SquareLock02Icon : undefined);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-etiquette px-2 pt-[3px] pb-1 text-xs leading-[17px] font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {leading && <Icon icon={leading} size={13} />}
      {children}
    </span>
  );
}
