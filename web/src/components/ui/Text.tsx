import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Échelle typographique de la planche « Fondations » (Inter).
const HEADING = {
  page: { tag: "h1", className: "text-[32px] leading-10 font-medium tracking-[-0.01em] text-titre text-balance max-sm:text-[26px] max-sm:leading-8" },
  section: { tag: "h2", className: "text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]" },
  card: { tag: "h3", className: "text-base leading-6 font-semibold text-encre" },
} as const;

type HeadingProps = {
  level: keyof typeof HEADING;
  as?: ElementType;
  className?: string;
  children: ReactNode;
};

/** Titre de page (32/40 · 500 ; 26/32 sur téléphone), de section (20/28 · 600 ; 18/26) ou de carte (16/24 · 600). */
export function Heading({ level, as, className, children }: HeadingProps) {
  const { tag, className: base } = HEADING[level];
  const Tag = as ?? tag;
  return <Tag className={cn("m-0", base, className)}>{children}</Tag>;
}

/** Chapeau sous un titre de page : 16/24 (15/22 sur téléphone). */
export function Lead({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("m-0 text-base leading-6 text-texte text-pretty max-sm:text-[15px] max-sm:leading-[22px]", className)} {...props} />;
}

/** Description, métadonnée : 12/18, texte discret. */
export function Description({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p className={cn("m-0 text-xs leading-[18px] text-discret text-pretty", className)} {...props} />;
}

/** Intertitre en capitales : 13,5 px, ardoise. */
export function Eyebrow({ as: Tag = "p", className, children }: { as?: ElementType; className?: string; children: ReactNode }) {
  return (
    <Tag className={cn("m-0 text-[13.5px] leading-5 font-medium tracking-[0.04em] text-ardoise uppercase", className)}>
      {children}
    </Tag>
  );
}
