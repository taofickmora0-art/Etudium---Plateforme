import { useId, type ReactNode } from "react";
import { Heading } from "@/components/ui/Text";

/** Une section de la fiche d'un compte : carte blanche titrée (comme les blocs d'une formation au back-office). */
export function Section({ titre, children }: { titre: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-5 sm:p-6">
      <Heading level="card" as="h2">
        <span id={id}>{titre}</span>
      </Heading>
      {children}
    </section>
  );
}
