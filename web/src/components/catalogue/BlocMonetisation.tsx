import Link from "next/link";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import type { Monetisation } from "@/lib/catalogue/monetisation";
import type { CarteCatalogue } from "@/lib/catalogue/types";
import { cn } from "@/lib/cn";

// Le lien compétence → monétisation sur une fiche (restructuration, §5.3 ; liste du 31 octobre 2026, tâche 14).

type Variante = "public" | "connecte";

const SECTION: Record<Variante, string> = {
  public: "box-border flex flex-col gap-5 rounded-panneau bg-panneau p-[clamp(24px,4vw,48px)]",
  connecte: "flex min-w-0 flex-col gap-4",
};
const TITRE: Record<Variante, string> = {
  public: "m-0 text-[clamp(28px,3.5vw,44px)] leading-[1.08] font-medium tracking-[-0.028em] text-balance text-titre",
  connecte: "m-0 text-xl leading-7 font-semibold text-encre",
};

/** Une formation liée : son titre, son résumé, et la flèche vers sa fiche. */
function Lien({ carte }: { carte: CarteCatalogue }) {
  return (
    <li className="min-w-0">
      <Link
        href={`/formations/${carte.slug}`}
        className="focus-etudium box-border flex h-full min-w-0 items-center gap-3 rounded-carte border border-bordure-carte bg-panneau px-4 py-3.5 text-inherit no-underline transition-colors hover:bg-page"
      >
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{carte.titre}</span>
          {carte.resume && <span className="line-clamp-2 text-[13px] leading-5 text-discret">{carte.resume}</span>}
        </span>
        <span className="flex flex-none text-discret">
          <Icon icon={ArrowRight01Icon} size={18} />
        </span>
      </Link>
    </li>
  );
}

function Bloc({ id, titre, texte, cartes, variante }: { id: string; titre: string; texte: string; cartes: CarteCatalogue[]; variante: Variante }) {
  return (
    <section aria-labelledby={`${id}-titre`} className={SECTION[variante]}>
      <div className="flex flex-col gap-1.5">
        <h2 id={`${id}-titre`} className={TITRE[variante]}>
          {titre}
        </h2>
        <p className="m-0 text-sm leading-[22px] text-pretty text-discret">{texte}</p>
      </div>
      <ul className={cn("m-0 grid list-none gap-3 p-0", "grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))]")}>
        {cartes.map((carte) => (
          <Lien key={carte.id} carte={carte} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Sur la fiche d'une formation Business : « À suivre d'abord », les compétences qu'elle apprend à vendre. Sur la fiche
 * d'une compétence : « Et ensuite ? Vendre cette compétence », les formations Business qui la monétisent. Rien sans lien.
 */
export function BlocMonetisation({ monetisation, variante }: { monetisation?: Monetisation | null; variante: Variante }) {
  if (!monetisation) return null;
  return (
    <>
      {monetisation.aSuivre.length > 0 && (
        <Bloc
          id="a-suivre"
          titre="À suivre d’abord"
          texte="Cette formation vous apprend à vendre une compétence : commencez par l’acquérir."
          cartes={monetisation.aSuivre}
          variante={variante}
        />
      )}
      {monetisation.aVendre.length > 0 && (
        <Bloc
          id="vendre"
          titre="Et ensuite ? Vendre cette compétence"
          texte="Les formations du parcours Business qui vous apprennent à trouver des clients avec cette compétence."
          cartes={monetisation.aVendre}
          variante={variante}
        />
      )}
    </>
  );
}
