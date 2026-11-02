import { useId } from "react";
import { Award01Icon, FireIcon, Medal01Icon } from "@hugeicons/core-free-icons";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { BADGES, jours, points } from "@/lib/engagement/regles";
import type { ProgressionJeu } from "@/lib/engagement/types";

function Chiffre({ icon, fond, texte }: { icon: IconSvgElement; fond: string; texte: string }) {
  return (
    <li className="box-border flex min-w-0 flex-col items-center gap-2 rounded-[14px] bg-page px-1 py-3.5">
      <span aria-hidden="true" className={`flex size-9 flex-none items-center justify-center rounded-[10px] ${fond}`}>
        <Icon icon={icon} size={18} />
      </span>
      <span className="text-sm leading-5 font-semibold whitespace-nowrap text-encre">{texte}</span>
    </li>
  );
}

/**
 * La carte « Gamification » du profil (NdProfil ; lot 6 B) : le niveau, la série, les badges, et ce qu'il manque pour
 * le niveau suivant. Chacun ne voit que les siens : pas de classement.
 */
export function CarteGamification({ jeu }: { jeu: ProgressionJeu }) {
  const titreId = useId();
  const nombre = jeu.badges.length;
  return (
    <section aria-labelledby={titreId} className="box-border flex min-w-0 flex-col rounded-carte border border-bordure-carte bg-panneau p-5">
      <h3 id={titreId} className="m-0 text-base leading-6 font-semibold text-encre">
        Gamification
      </h3>
      <ul className="m-0 mt-3.5 grid list-none grid-cols-3 gap-2 p-0">
        <Chiffre icon={Medal01Icon} fond="bg-premium-fond text-premium-texte" texte={`Niveau ${jeu.niveau}`} />
        <Chiffre icon={FireIcon} fond="bg-attention-fond text-attention-texte" texte={jours(jeu.serie)} />
        <Chiffre icon={Award01Icon} fond="bg-bleu-pale text-bleu" texte={`${nombre} badge${nombre > 1 ? "s" : ""}`} />
      </ul>
      <p className="m-0 mt-3 text-[13px] leading-5 text-pretty text-discret">{`Encore ${points(jeu.pointsAvantNiveau)} pour atteindre le niveau ${jeu.niveau + 1}.`}</p>
      {nombre > 0 ? (
        <ul aria-label="Badges obtenus" className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
          {jeu.badges.map((b) => (
            <li key={b.code}>
              <Tag tone="compteur">{BADGES[b.code].nom}</Tag>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-3 text-[13px] leading-5 text-pretty text-texte">Terminez une leçon pour obtenir « Premier pas ».</p>
      )}
    </section>
  );
}
