import Link from "next/link";
import { MoreHorizontalIcon, PinIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/ui/Icon";
import { iconButtonVariants } from "@/components/ui/IconButton";
import { Tag } from "@/components/ui/Tag";
import type { Annonce } from "@/lib/communaute/types";
import { VideoYoutube } from "./VideoYoutube";

/**
 * L'annonce épinglée en tête des Actualités (design NdCommunaute ; spec du fil « Actualités », §2) : la vidéo (au clic)
 * ou l'affiche, l'étiquette, le titre et le texte ; pour l'équipe, ⋮ « Gérer l’annonce » vers le back-office.
 */
export function CarteAnnonce({ annonce, equipe = false }: { annonce: Annonce; equipe?: boolean }) {
  return (
    <article aria-label="Annonce de l’équipe Étudium" className="box-border flex min-w-0 flex-col overflow-hidden rounded-2xl border border-bordure-carte bg-panneau">
      {annonce.media === "youtube" && annonce.youtubeId && <VideoYoutube id={annonce.youtubeId} libelle="Lire la vidéo" accent lien={false} />}
      {annonce.media === "image" && annonce.image && (
        // Un lien temporaire de Supabase : l'optimisation d'images de Next ne s'y applique pas.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={annonce.image} alt={`Affiche : ${annonce.titre}`} className="block max-h-[440px] w-full bg-coque object-cover" />
      )}
      <div className="flex min-w-0 flex-col gap-2 px-5 pt-4 pb-[18px] max-sm:px-4 max-sm:pt-3 max-sm:pb-4">
        <div className="flex min-h-[34px] items-center justify-between gap-2">
          <Tag tone="nouveau" icon={PinIcon}>
            Annonce épinglée
          </Tag>
          {equipe && (
            <Link href="/admin/communaute" aria-label="Gérer l’annonce" className={iconButtonVariants({ variant: "discret", size: "sm" })}>
              <Icon icon={MoreHorizontalIcon} size={18} />
            </Link>
          )}
        </div>
        {annonce.titre && <h2 className="m-0 text-2xl leading-8 font-semibold tracking-[-0.01em] text-balance wrap-anywhere text-encre max-sm:text-lg max-sm:leading-[26px]">{annonce.titre}</h2>}
        {annonce.texte && <p className="m-0 text-sm leading-[22px] whitespace-pre-line text-pretty wrap-anywhere text-discret max-sm:text-[13px] max-sm:leading-5">{annonce.texte}</p>}
      </div>
    </article>
  );
}
