import { cn } from "@/lib/cn";

type SpinnerProps = {
  size?: number;
  /** Couleur de l'arc qui tourne (par défaut, celle du texte). */
  className?: string;
  /** Couleur de la piste (par défaut #D6DDEC, comme sur les planches). */
  trackColor?: string;
  /** Quand l'indicateur est seul à l'écran, son libellé est annoncé (« Chargement de la leçon… »). */
  label?: string;
};

/** Indicateur d'attente : piste circulaire et arc qui tourne (planches « Boutons » et « Messages »). */
export function Spinner({ size = 18, className, trackColor = "#D6DDEC", label }: SpinnerProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn("block flex-none animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={trackColor} strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
