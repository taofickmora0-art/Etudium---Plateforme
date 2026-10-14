import { cn } from "@/lib/cn";

/** La pastille rouge d'une nouveauté (« 2 ») ; au-delà de 9, « 9+ ». Le nombre est dit par le libellé de son lien. */
export function PastilleNombre({ nombre, className }: { nombre: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-erreur-vif px-1.5 text-[11px] leading-none font-semibold text-white tabular-nums",
        className,
      )}
    >
      {nombre > 9 ? "9+" : nombre}
    </span>
  );
}
