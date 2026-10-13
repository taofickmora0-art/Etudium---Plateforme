import Link from "next/link";
import { ArrowRight01Icon, PlayCircleIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { IconTile } from "@/components/ui/IconTile";
import type { ElementAFaire } from "@/lib/accueil/regles";

/**
 * « À faire » (annexe 1.10 §3.5, téléphone §4.5) : une ligne par leçon suivante, vers la leçon. Boîte bordée sur
 * ordinateur, lignes nues sur téléphone. Quiz et exercices arrivent au lot 3.
 */
export function ListeAFaire({ elements }: { elements: ElementAFaire[] }) {
  return (
    <div className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau px-[15px] py-1 max-sm:border-0 max-sm:p-0">
      <ul className="m-0 flex list-none flex-col p-0 [&>li+li]:border-t [&>li+li]:border-bordure-carte">
        {elements.map((element) => (
          <li key={element.id}>
            <Link
              href={element.href}
              className="focus-etudium flex min-h-12 items-center gap-3.5 px-1 py-3.5 text-inherit no-underline transition-colors hover:bg-page"
            >
              <IconTile icon={PlayCircleIcon} size={44} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] leading-[22px] font-medium text-encre">{element.titre}</span>
                <span className="text-[13px] leading-5 text-discret wrap-anywhere">{element.sousTitre}</span>
              </span>
              <span className="flex flex-none text-discret">
                <Icon icon={ArrowRight01Icon} size={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
