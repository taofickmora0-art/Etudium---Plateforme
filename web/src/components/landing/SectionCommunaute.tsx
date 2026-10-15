import Link from "next/link";
import { ArrowRight02Icon, BubbleChatIcon, FavouriteIcon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MetaDot } from "@/components/ui/Progress";
import { EnTeteSection } from "./BlocsLanding";

/** Une publication de la communauté (§11) : inventée, donc illustration non lue, sans lien ni bouton. */
function PublicationIllustree() {
  return (
    <div aria-hidden="true" className="relative mx-auto max-w-[520px] px-[18px] pt-3.5 pb-[26px] max-sm:px-1.5 max-sm:pb-5">
      <div className="absolute top-[34px] right-1 bottom-1.5 left-[34px] rotate-3 rounded-carte bg-panneau opacity-60" />
      <div className="relative box-border flex min-w-0 -rotate-[1.5deg] flex-col rounded-carte bg-panneau px-6 pt-6 pb-[18px] shadow-[0_18px_44px_rgba(11,24,201,0.16)] max-sm:px-5 max-sm:pt-5">
        <div className="flex items-center gap-3">
          <Avatar initials="KD" size={44} />
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] leading-[22px] font-semibold text-encre">Koffi D.</span>
            <span className="text-[13px] leading-5 text-discret">Espace Académique · il y a 2 h</span>
          </span>
        </div>
        <p className="mt-4 mb-0 text-[17px] leading-[27px] text-pretty text-texte max-sm:text-[15px] max-sm:leading-6">
          J’ai enfin terminé ma revue de littérature grâce à la méthode du module 2. Merci à tous pour vos conseils !
        </p>
        <div className="mt-[18px] h-px bg-bordure-carte" />
        <div className="mt-3.5 flex flex-wrap items-center gap-3.5 text-sm leading-[22px] text-discret">
          <span className="flex items-center gap-1">
            <Icon icon={FavouriteIcon} size={18} />
            24
          </span>
          <MetaDot />
          <span className="flex items-center gap-1">
            <Icon icon={BubbleChatIcon} size={18} />8
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Communauté (NdLanding §11), cible de « Communauté » dans l'en-tête. « Voir la communauté » mène à l'Accueil, qui est
 * la communauté : un visiteur passe d'abord par la connexion.
 */
export function SectionCommunaute() {
  return (
    <section
      id="communaute"
      aria-labelledby="titre-communaute"
      className="box-border min-w-0 rounded-panneau bg-bleu-clair p-[clamp(28px,5vw,64px)] max-sm:px-5 max-sm:py-7"
    >
      <div className="flex flex-wrap items-center gap-14 max-sm:gap-8">
        <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-[26px] max-sm:gap-5">
          <EnTeteSection
            pastille="Communauté"
            ton="blanc"
            titre="Une communauté par parcours"
            idTitre="titre-communaute"
            chapeau="Posez vos questions, partagez vos réussites et entraidez-vous. Un espace général ouvert à tous, et un espace privé pour chaque parcours."
          />
          <Button asChild size="lg" className="self-start">
            <Link href="/accueil">
              <span>Voir la communauté</span>
              <Icon icon={ArrowRight02Icon} size={20} />
            </Link>
          </Button>
        </div>
        <div className="min-w-0 flex-[1_1_500px]">
          <PublicationIllustree />
        </div>
      </div>
    </section>
  );
}
