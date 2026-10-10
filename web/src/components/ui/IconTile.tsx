import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

// Pastille carrée qui porte une icône : indicateurs, listes, fichiers.
const SIZES = {
  40: { box: "size-10 rounded-champ", icon: 18 },
  44: { box: "size-11 rounded-[13px]", icon: 20 },
} as const;

const TONES = {
  neutre: "bg-coque text-texte",
  blanc: "bg-panneau text-texte",
  reussite: "bg-reussite-fond text-reussite-texte",
  attention: "bg-attention-fond text-attention-texte",
} as const;

export type IconTileTone = keyof typeof TONES;

export function IconTile({ icon, size = 40, tone = "neutre", className }: { icon: IconSvgElement; size?: keyof typeof SIZES; tone?: IconTileTone; className?: string }) {
  return (
    <span className={cn("flex flex-none items-center justify-center", SIZES[size].box, TONES[tone], className)}>
      <Icon icon={icon} size={SIZES[size].icon} />
    </span>
  );
}
