import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { AvatarImage } from "./AvatarImage";

// Planche « Boutons », « Avatars et progression ».
const SIZES = {
  64: "size-16 text-[23px]",
  56: "size-14 text-xl",
  52: "size-[52px] text-[19px]",
  48: "size-12 text-[17px]",
  44: "size-11 text-base",
  40: "size-10 text-sm",
  32: "size-8 text-xs",
} as const;

const TONES = {
  bleu: "bg-bleu-pale text-bleu",
  violet: "bg-premium-fond text-premium-texte",
  ambre: "bg-attention-fond text-attention-texte",
} as const;

type AvatarProps = {
  initials: string;
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  /** Nom complet annoncé à la place des initiales (« Aïcha Kpadé »). */
  name?: string;
  /** Photo de profil : remplace les initiales. */
  src?: string | null;
  className?: string;
};

export function Avatar({ initials, size = 40, tone = "bleu", name, src, className }: AvatarProps) {
  return (
    <span
      className={cn("flex flex-none items-center justify-center overflow-hidden rounded-full font-semibold", SIZES[size], TONES[tone], className)}
      {...(name ? { role: "img", "aria-label": name } : {})}
    >
      {src ? (
        <AvatarImage key={src} src={src} initials={initials} hideInitials={Boolean(name)} />
      ) : (
        <span aria-hidden={name ? true : undefined}>{initials}</span>
      )}
    </span>
  );
}

/** Avatars qui se chevauchent de 6 px, chacun cerclé de blanc ; le premier est devant. */
export function AvatarGroup({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <span
      className="flex items-center [&>*]:relative [&>*]:shadow-[0_0_0_2px_#fff] [&>*:not(:first-child)]:-ml-1.5 [&>*:nth-child(1)]:z-[3] [&>*:nth-child(2)]:z-[2] [&>*:nth-child(3)]:z-[1]"
      {...(label ? { role: "group", "aria-label": label } : {})}
    >
      {children}
    </span>
  );
}
