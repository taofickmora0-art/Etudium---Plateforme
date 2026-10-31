"use client";

import { ArrowUp02Icon } from "@hugeicons/core-free-icons";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { NouvellesPublications } from "@/lib/communaute/types";
import { tonAvatar } from "./outils";

/**
 * « 2 nouvelles publications » (liste du 31 octobre 2026, tâche 9) : en haut de l'écran, au milieu de la page, juste
 * sous la barre du haut, et il y reste quand la page défile (placé en tête de la page, pas du fil : sinon on ne le voyait
 * pas depuis le haut de l'Accueil). Les photos (ou initiales) des derniers auteurs, puis le nombre ; un appui relit le fil.
 * La zone est annoncée poliment aux lecteurs d'écran quand le bandeau apparaît.
 */
export function BandeauNouvellesPublications({ nouvelles, onVoir }: { nouvelles: NouvellesPublications; onVoir: () => void }) {
  const { nombre, auteurs } = nouvelles;
  const libelle = nombre === 1 ? "1 nouvelle publication" : `${nombre > 99 ? "99+" : nombre} nouvelles publications`;
  return (
    // Sans hauteur : le bandeau flotte au-dessus de la page sans la pousser.
    <div aria-live="polite" className="pointer-events-none sticky top-[calc(var(--entete-app)+12px)] z-20 flex h-0 justify-center">
      {nombre > 0 && (
        <button
          type="button"
          onClick={onVoir}
          className="focus-etudium pointer-events-auto inline-flex h-10 flex-none items-center gap-2 rounded-full bg-bleu pr-4 pl-3 text-sm leading-5 font-semibold whitespace-nowrap text-white shadow-[0_10px_24px_-8px_rgba(18,52,120,0.45)] transition-colors hover:bg-bleu-survol max-sm:h-9 max-sm:pr-3.5 max-sm:pl-2.5 max-sm:text-[13px]"
        >
          <Icon icon={ArrowUp02Icon} size={16} />
          {auteurs.length > 0 && (
            <span aria-hidden="true">
              <AvatarGroup>
                {auteurs.map((a, n) => (
                  <Avatar key={`${a.initiales}-${n}`} initials={a.initiales} size={22} tone={tonAvatar(a.initiales)} src={a.photoUrl} />
                ))}
              </AvatarGroup>
            </span>
          )}
          {libelle}
        </button>
      )}
    </div>
  );
}
