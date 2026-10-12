import type { ReactNode } from "react";
import { EnTetePublic } from "./EnTetePublic";
import { PiedDePagePublic } from "./PiedDePagePublic";

/**
 * Cadre des pages publiques (NdCataloguePublic, NdFormationPublic) : fond de page, en-tête public, puis un grand bloc
 * gris-bleu arrondi (32 px) qui empile les sections de la page et, en dernier, le pied de page.
 * Marges de 20 px comme le design ; réduites à 8 px sous 640 px pour garder de la place au contenu sur téléphone.
 */
export function CadrePublic({ children }: { children: ReactNode }) {
  return (
    <div className="box-border flex min-h-dvh flex-col bg-page px-2 pb-2 sm:px-5 sm:pb-5">
      <EnTetePublic />
      <div className="flex flex-1 flex-col gap-5 rounded-coque bg-coque p-2 sm:p-5">
        <main id="contenu" className="flex flex-1 flex-col gap-5">
          {children}
        </main>
        <PiedDePagePublic />
      </div>
    </div>
  );
}
