import Link from "next/link";
import { BubbleChatIcon, Shield01Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { Carte } from "@/components/tableau/Blocs";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";

// La vue d'ensemble d'un modérateur (lot 6 A, spec §1.2) : ce qu'il a à traiter dans la communauté, sans les chiffres
// de la plateforme (domaine « statistiques »). null : la lecture a échoué, « — ».

type Props = { aExaminer: number | null; messagesNonLus: number | null; sessionsAVenir: number | null };

function Ligne({ href, icon, label, valeur }: { href: string; icon: IconSvgElement; label: string; valeur: number | null }) {
  return (
    <Link
      href={href}
      className="focus-etudium flex min-h-11 items-center gap-3 rounded-champ px-3 py-2.5 text-encre no-underline hover:bg-page"
    >
      <Icon icon={icon} size={20} className="shrink-0 text-bleu" />
      <span className="min-w-0 flex-1 text-[15px] leading-[22px] font-medium">{label}</span>
      <span className="text-lg leading-7 font-semibold tabular-nums">{valeur === null ? "—" : valeur.toLocaleString("fr-FR")}</span>
    </Link>
  );
}

export function TableauModerateur({ aExaminer, messagesNonLus, sessionsAVenir }: Props) {
  return (
    <div className="max-w-[680px]">
      <Carte titre="À traiter">
        <div className="flex flex-col">
          <Ligne href="/admin/moderation" icon={Shield01Icon} label="Contenus à examiner" valeur={aExaminer} />
          <Ligne href="/admin/messages" icon={BubbleChatIcon} label="Messages non lus" valeur={messagesNonLus} />
          <Ligne href="/admin/sessions" icon={Video01Icon} label="Sessions live à venir" valeur={sessionsAVenir} />
        </div>
      </Carte>
    </div>
  );
}
