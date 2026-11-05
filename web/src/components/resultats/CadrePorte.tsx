import type { ReactNode } from "react";
import { LockPasswordIcon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Heading } from "@/components/ui/Text";

type CadrePorteProps = {
  icone?: IconSvgElement;
  titre: string;
  texte?: ReactNode;
  children?: ReactNode;
};

/** Le cadre des écrans de la porte de « Mes résultats » (clavier, proposition, nouveau code) : centré, 440 px. */
export function CadrePorte({ icone = LockPasswordIcon, titre, texte, children }: CadrePorteProps) {
  return (
    <section className="mx-auto box-border flex w-full max-w-[440px] flex-col items-center rounded-carte border border-bordure-carte bg-panneau px-7 py-8 text-center max-sm:px-5 max-sm:py-6">
      <span className="mb-4 flex size-14 flex-none items-center justify-center rounded-carte bg-bleu-pale text-bleu max-sm:mb-3 max-sm:size-12">
        <Icon icon={icone} size={24} />
      </span>
      <Heading level="section" className="text-balance">
        {titre}
      </Heading>
      {texte && <p className="mt-2 mb-0 text-sm leading-[22px] text-pretty text-discret max-sm:text-[13px] max-sm:leading-5">{texte}</p>}
      {children && <div className="mt-6 flex w-full flex-col items-center gap-4 max-sm:mt-5">{children}</div>}
    </section>
  );
}
