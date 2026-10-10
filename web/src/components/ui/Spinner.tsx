import { cn } from "@/lib/cn";

type SpinnerProps = {
  size?: number;
  /** Couleur de l'arc qui tourne (par défaut, celle du texte). */
  className?: string;
  /** Couleur de la piste (par défaut #D6DDEC, comme sur les planches). */
  trackColor?: string;
  /**
   * Quand l'indicateur est seul à l'écran : texte affiché à côté (« Chargement de la leçon… »)
   * et annoncé aux lecteurs d'écran. Sans libellé, l'indicateur est décoratif (bouton en chargement).
   */
  label?: string;
};

function Arc({ size, className, trackColor }: Required<Pick<SpinnerProps, "size" | "trackColor">> & { className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("block flex-none animate-spin motion-reduce:animate-[spin_1.6s_linear_infinite]", className)}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke={trackColor} strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Indicateur d'attente : piste circulaire et arc qui tourne (planches « Boutons » et « Messages »). */
export function Spinner({ size = 18, className, trackColor = "#D6DDEC", label }: SpinnerProps) {
  if (!label) return <Arc size={size} trackColor={trackColor} className={className} />;
  return (
    <span role="status" aria-label={label} className="flex h-12 items-center gap-3">
      <Arc size={size} trackColor={trackColor} className={cn("text-bleu", className)} />
      <span className="text-sm text-texte">{label}</span>
    </span>
  );
}
