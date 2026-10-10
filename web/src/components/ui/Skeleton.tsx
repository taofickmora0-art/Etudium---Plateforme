import { cn } from "@/lib/cn";

/** Bloc gris-bleu qui tient la place d'un contenu en cours de chargement. Donner taille et rayon par `className`. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("block rounded-md bg-coque motion-safe:animate-pulse", className)} />;
}

/** Carte de formation en cours de chargement (planche « Messages », « Chargement et aides »). */
export function SkeletonCard({ label = "Chargement…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("box-border flex w-full flex-col rounded-carte border border-bordure-carte px-[19px] pt-[22px] pb-[17px]", className)}
    >
      <Skeleton className="size-12 rounded-bouton" />
      <Skeleton className="mt-6 h-[18px] w-[70%]" />
      <Skeleton className="mt-[18px] h-3 w-full" />
      <Skeleton className="mt-2 h-3 w-[85%]" />
      <Skeleton className="mt-[21px] h-2 w-full rounded-full" />
      <Skeleton className="mt-3 h-3 w-[45%]" />
    </div>
  );
}
