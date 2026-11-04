import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";
import { SearchInput } from "./SearchInput";

// Les deux volets des Messages et des Groupes (demande du 4 novembre 2026, « comme WhatsApp ») : à gauche la liste, à
// droite la conversation ouverte, dans un seul panneau à la hauteur de l'écran ; chaque volet défile seul. Sous 768 px,
// un seul à la fois : la liste, ou la conversation ouverte (avec son retour).

/** La hauteur disponible sous l'en-tête de l'appli (marges de la page et barre du bas du téléphone comprises). */
export const HAUTEUR_VOLETS = "h-[calc(100dvh-var(--entete-app)-112px)] max-sm:h-[calc(100dvh-var(--entete-app)-104px)] lg:h-[calc(100dvh-var(--entete-app)-120px)]";

export function DeuxVolets({ liste, children, ouvert, className }: { liste: ReactNode; children: ReactNode; ouvert: boolean; className?: string }) {
  return (
    <div className={cn("box-border flex min-h-[420px] min-w-0 overflow-hidden rounded-carte border border-bordure-carte bg-panneau max-sm:-mx-1.5", HAUTEUR_VOLETS, className)}>
      <div className={cn("flex min-h-0 w-[340px] flex-none flex-col border-r border-bordure-carte lg:w-[360px] max-md:w-full max-md:border-r-0", ouvert && "max-md:hidden")}>
        {liste}
      </div>
      <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col", !ouvert && "max-md:hidden")}>{children}</div>
    </div>
  );
}

/** Le haut du volet de gauche : le titre de la page, son action, la recherche. */
export function EnteteVolet({
  titre,
  action,
  recherche,
  onRecherche,
  placeholder,
}: {
  titre: string;
  action?: ReactNode;
  recherche: string;
  onRecherche: (valeur: string) => void;
  placeholder: string;
}) {
  return (
    <div className="flex flex-none flex-col gap-3 px-4 pt-4 pb-3 max-sm:px-3 max-sm:pt-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <h1 className="m-0 text-xl leading-7 font-semibold text-encre max-sm:text-lg max-sm:leading-[26px]">{titre}</h1>
        {action}
      </div>
      <SearchInput value={recherche} onChange={(e) => onRecherche(e.target.value)} placeholder={placeholder} aria-label={placeholder} autoComplete="off" />
    </div>
  );
}

/** Le volet de droite sans conversation ouverte. */
export function VoletVide({ icon, titre, description }: { icon: IconSvgElement; titre: string; description: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-page px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-bleu-clair text-bleu">
        <Icon icon={icon} size={28} />
      </span>
      <p className="m-0 text-lg leading-[26px] font-semibold text-encre">{titre}</p>
      <p className="m-0 max-w-[360px] text-sm leading-[22px] text-pretty text-discret">{description}</p>
    </div>
  );
}

/** Le filtre de la recherche : sans accents ni majuscules. */
export const correspond = (nom: string, recherche: string) => {
  const simple = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  return simple(nom).includes(simple(recherche.trim()));
};
