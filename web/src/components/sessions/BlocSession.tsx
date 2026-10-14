import Link from "next/link";
import { CheckmarkCircle02Icon, UserIcon, UserMultipleIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { dateSession, jourCarte, libelleInscriptions, phraseSession, terminee } from "@/lib/sessions/regles";
import type { SessionPublication } from "@/lib/sessions/types";

// La plateforme, reconnaissable d'un coup d'œil (« la séance sera sur Google Meet ou sur Zoom »).
const PLATEFORMES: Record<string, string> = {
  "Google Meet": "bg-[#E6F4EA] text-[#137333]",
  Zoom: "bg-[#E8F0FE] text-[#0B5CFF]",
};

/**
 * Le bloc d'une session live dans sa publication de la communauté (spec promotion des sessions live, §2) : le jour,
 * « Session live », la date et l'heure, la plateforme, l'animateur, les inscriptions, et « Voir la session ». Jamais le
 * lien du live, réservé à sa fenêtre de 10 min sur la page Événements.
 */
export function BlocSession({ session: s, maintenant, className }: { session: SessionPublication; maintenant: Date; className?: string }) {
  const { mois, jour } = jourCarte(s.debut);
  const annulee = s.statut === "annulee";
  const finie = terminee(s, maintenant);
  return (
    <div
      role="group"
      aria-label={`Session live du ${phraseSession(s.debut)}`}
      className={cn("mt-3.5 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-3 rounded-[14px] border border-bordure-carte bg-coque/60 p-3.5 max-sm:p-3", className)}
    >
      <span aria-hidden="true" className="flex size-14 flex-none flex-col items-center justify-center rounded-[14px] bg-panneau max-sm:size-12">
        <span className="text-xs leading-4 font-medium tracking-[0.04em] text-ardoise max-sm:text-[11px]">{mois}</span>
        <span className="text-xl leading-6 font-semibold text-encre max-sm:text-lg">{jour}</span>
      </span>
      <div className="flex min-w-0 flex-[1_1_220px] flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="enAttente" icon={Video01Icon}>
            Session live
          </Tag>
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs leading-[18px] font-semibold",
              PLATEFORMES[s.plateforme] ?? "bg-coque text-ardoise",
            )}
          >
            <Icon icon={Video01Icon} size={14} />
            {s.plateforme}
          </span>
        </div>
        <p className="m-0 text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{dateSession(s.debut)}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-discret">
          <span className="flex min-w-0 items-center gap-1">
            <Icon icon={UserIcon} size={14} className="flex-none" />
            <span className="min-w-0 wrap-anywhere">{s.animateur}</span>
          </span>
          <span className="flex items-center gap-1">
            <Icon icon={UserMultipleIcon} size={14} />
            <span>{libelleInscriptions(s.inscriptions)}</span>
          </span>
        </div>
      </div>
      <div className="flex flex-none flex-wrap items-center gap-2">
        {annulee ? (
          <Tag tone="echoue">Annulée</Tag>
        ) : finie ? (
          <Tag tone="enAttente">Terminée</Tag>
        ) : (
          <>
            {s.inscrit && (
              <span className="inline-flex items-center gap-1 text-[13px] leading-5 font-medium text-reussite-texte">
                <Icon icon={CheckmarkCircle02Icon} size={16} />
                Inscription confirmée
              </span>
            )}
            <Button asChild size="sm">
              <Link href="/evenements">Voir la session</Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
