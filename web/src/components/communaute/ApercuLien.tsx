import { Link01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { domaine, type Apercu } from "@/lib/communaute/liens";

// Les sites de visioconférence : une caméra à la place de l'image absente (Google Meet, Zoom, Teams…).
const VISIO = /(^|\.)(meet\.google\.com|zoom\.us|teams\.microsoft\.com|teams\.live\.com|whereby\.com|meet\.jit\.si)$/i;

/**
 * La carte d'un site (spec du fil « Actualités », §3) : son image, le domaine tiré de l'adresse (jamais d'une donnée de
 * la page), le titre et la description lus par le serveur. L'image est demandée sans transmettre la page d'origine.
 */
export function ApercuLien({ apercu }: { apercu: Extract<Apercu, { type: "lien" }> }) {
  const site = domaine(apercu.url);
  return (
    <a
      href={apercu.url}
      target="_blank"
      rel="noopener nofollow ugc"
      className="focus-etudium mt-3.5 flex min-w-0 flex-col overflow-hidden rounded-[14px] border border-bordure-carte text-inherit no-underline transition-colors hover:border-bordure-champ"
    >
      {apercu.image ? (
        // L'image d'un autre site : l'optimisation d'images de Next ne s'y applique pas.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={apercu.image} alt="" referrerPolicy="no-referrer" loading="lazy" className="block aspect-[1.91/1] max-h-[320px] w-full bg-coque object-cover" />
      ) : (
        <span className="flex h-[150px] items-center justify-center bg-coque">
          <span className="flex size-[72px] items-center justify-center rounded-[20px] bg-panneau text-bleu shadow-[0_1px_2px_rgba(20,20,30,0.08)]">
            <Icon icon={VISIO.test(site) ? Video01Icon : Link01Icon} size={32} />
          </span>
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-0.5 bg-page px-3.5 py-3">
        <span className="truncate text-xs leading-[17px] tracking-[0.04em] text-discret uppercase">{site}</span>
        {apercu.titre && <span className="line-clamp-2 text-[15px] leading-[22px] font-semibold wrap-anywhere text-encre">{apercu.titre}</span>}
        {apercu.description && <span className="line-clamp-2 text-[13px] leading-5 wrap-anywhere text-discret">{apercu.description}</span>}
      </span>
    </a>
  );
}
