"use client";

import Link from "next/link";
import { useFuseau } from "@/components/dates/useFuseau";
import { CheckmarkCircle02Icon, UserIcon, UserMultipleIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Tag } from "@/components/ui/Tag";
import { cn } from "@/lib/cn";
import { jourCarte, libelleInscriptions, quandSession, terminee } from "@/lib/sessions/regles";
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
export function BlocSession({
  session: s,
  maintenant,
  apercu = false,
  lienSession = "/evenements",
  lienReplays = "/accueil?espace=replays",
  className,
}: {
  session: SessionPublication;
  maintenant: Date;
  /** Dans l'aperçu du formulaire : « Voir la session » n'est pas un lien (la saisie n'est pas perdue). */
  apercu?: boolean;
  /** La page des sessions ; null : pas de « Voir la session » (le formateur n'a pas la page Événements, R1). */
  lienSession?: string | null;
  /** Une fois la session terminée : « Voir le replay », vers l'onglet des replays de la communauté (0046). */
  lienReplays?: string | null;
  className?: string;
}) {
  // À l'heure de l'appareil, avec son décalage GMT (tâche 10 du 31 octobre 2026).
  const fuseau = useFuseau();
  const { mois, jour } = jourCarte(s.debut, fuseau);
  const annulee = s.statut === "annulee";
  const finie = terminee(s, maintenant);
  return (
    <div
      role="group"
      aria-label={`Session live du ${quandSession(s.debut, fuseau, "phrase")}`}
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
        <p className="m-0 text-[15px] leading-[22px] font-semibold text-encre max-sm:text-sm">{quandSession(s.debut, fuseau)}</p>
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
          <>
            <Tag tone="enAttente">Terminée</Tag>
            {!apercu && lienReplays && (
              <Button asChild size="sm" variant="contour">
                <Link href={lienReplays}>Voir le replay</Link>
              </Button>
            )}
          </>
        ) : (
          <>
            {s.inscrit && (
              <span className="inline-flex items-center gap-1 text-[13px] leading-5 font-medium text-reussite-texte">
                <Icon icon={CheckmarkCircle02Icon} size={16} />
                Inscription confirmée
              </span>
            )}
            {apercu ? (
              <span className={buttonVariants({ size: "sm" })}>Voir la session</span>
            ) : lienSession ? (
              <Button asChild size="sm">
                <Link href={lienSession}>Voir la session</Link>
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
