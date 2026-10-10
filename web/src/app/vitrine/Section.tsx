import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/Text";

/** Bloc blanc d'une planche : rayon 28, intertitre en capitales. */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-panneau bg-panneau px-5 pt-6 pb-7 sm:px-8 sm:pt-7 sm:pb-8">
      <Eyebrow as="h3" className="mb-5">
        {title}
      </Eyebrow>
      {children}
    </section>
  );
}

/** Une planche de la vitrine : titre, chapeau, puis ses blocs. */
export function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titre`} className="flex flex-col gap-7">
      <div>
        <h2 id={`${id}-titre`} className="m-0 text-[32px] leading-10 font-medium tracking-[-0.01em] text-titre text-balance">
          {title}
        </h2>
        <p className="mt-2.5 mb-0 text-base leading-6 text-texte text-pretty">{description}</p>
      </div>
      {children}
    </section>
  );
}
