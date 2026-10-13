import { StarIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/cn";

/** Étoile pleine du design (Phosphor « Star », viewBox 256) : Hugeicons n'a pas d'étoile pleine. */
export function EtoilePleine({ taille, className }: { taille: number; className?: string }) {
  return (
    <svg viewBox="0 0 256 256" width={taille} height={taille} fill="currentColor" aria-hidden="true" className={cn("block flex-none", className)}>
      <path d="m234.29 114.85l-45 38.83L203 211.75a16.4 16.4 0 0 1-24.5 17.82L128 198.49l-50.53 31.08A16.4 16.4 0 0 1 53 211.75l13.76-58.07l-45-38.83A16.46 16.46 0 0 1 31.08 86l59-4.76l22.76-55.08a16.36 16.36 0 0 1 30.27 0l22.75 55.08l59 4.76a16.46 16.46 0 0 1 9.37 28.86Z" />
    </svg>
  );
}

/**
 * Cinq étoiles : pleines (#8A5A00) jusqu'à la note arrondie, contour au-delà. Avec `label`, l'ensemble est une image
 * nommée (« Note : 4 sur 5 ») ; sans, il est décoratif.
 */
export function EtoilesNote({ note, taille = 14, label, className }: { note: number; taille?: 14 | 16; label?: string; className?: string }) {
  const pleines = Math.round(note);
  return (
    <span role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn("flex gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((n) =>
        n <= pleines ? (
          <EtoilePleine key={n} taille={taille} className="text-attention-texte" />
        ) : (
          <Icon key={n} icon={StarIcon} size={taille} className="text-discret" />
        ),
      )}
    </span>
  );
}
