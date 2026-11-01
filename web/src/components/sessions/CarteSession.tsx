"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { Calendar03Icon, CheckmarkCircle02Icon, SquareLock02Icon, UserIcon, UserMultipleIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { useFuseau } from "@/components/dates/useFuseau";
import { Button } from "@/components/ui/Button";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { commenceDans, enCours, jourCarte, libelleInscriptions, quandSession, terminee } from "@/lib/sessions/regles";
import type { SessionCarte } from "@/lib/sessions/types";
import { AjouterAgenda } from "./AjouterAgenda";

const TONS_PARCOURS: Record<string, TagTone> = { academique: "academique", digital: "digital", business: "business" };
const LIEN_EN_ROUTE = "Le lien du live arrive. Réessayez dans un instant.";

/** Une information de la ligne du dessous : icône, texte (date, plateforme, animateur). */
function Info({ icon, children }: { icon: IconSvgElement; children: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <Icon icon={icon} size={14} className="flex-none" />
      <span className="min-w-0 wrap-anywhere">{children}</span>
    </span>
  );
}
const Point = () => <span aria-hidden="true" className="size-[3px] flex-none rounded-full bg-discret" />;

/** « Inscription confirmée » : la pastille verte du design (« Vous êtes inscrite »), en version neutre. */
export function InscriptionConfirmee() {
  return (
    <span className="box-border inline-flex h-[42px] items-center justify-center gap-2 rounded-champ bg-reussite-fond px-[15px] text-sm font-medium whitespace-nowrap text-reussite-texte">
      <Icon icon={CheckmarkCircle02Icon} size={18} />
      Inscription confirmée
    </span>
  );
}

type Props = {
  session: SessionCarte;
  maintenant: Date;
  onInscrire: (session: SessionCarte) => void;
  onDesinscrire: (session: SessionCarte) => void;
  /** L'inscription ou la désinscription est en cours d'envoi. */
  occupe?: boolean;
  /** Une fois la session terminée : « Voir le replay », vers l'onglet des replays de la communauté (0046). */
  lienReplays?: string;
};

/**
 * Une session (design NdEvenements) : le jour, le parcours, « Session live », les inscriptions, le titre, la date, la
 * plateforme, l'animateur, à l'heure de l'appareil avec son décalage GMT. « Rejoindre » est là jusqu'à la fin, pour
 * tous ; avant l'heure du début, il n'ouvre rien et dit le temps qui reste (tâche 10 du 31 octobre 2026), même si la
 * base a déjà livré le lien (10 min avant).
 */
export function CarteSession({ session: s, maintenant, onInscrire, onDesinscrire, occupe = false, lienReplays = "/accueil?espace=replays" }: Props) {
  const titreId = useId();
  const fuseau = useFuseau();
  const [attente, setAttente] = useState<string | null>(null);
  const { mois, jour } = jourCarte(s.debut, fuseau);
  const annulee = s.statut === "annulee";
  const reservee = s.reservee === true;
  const finie = terminee(s, maintenant);
  const commencee = Date.parse(s.debut) <= maintenant.getTime();
  const ouverte = !annulee && !finie;

  /** « Rejoindre » sans lien ouvrable : trop tôt (le temps qui reste, depuis l'instant du clic), ou le lien en route. */
  function rejoindreTropTot() {
    const instant = new Date();
    if (Date.parse(s.debut) <= instant.getTime()) {
      if (s.lien) window.open(s.lien, "_blank", "noopener,noreferrer");
      else setAttente(LIEN_EN_ROUTE);
      return;
    }
    setAttente(`Le live n’a pas encore commencé. Il commence dans ${commenceDans(s.debut, instant)} : ${quandSession(s.debut, fuseau, "phrase")}.`);
  }

  return (
    <article aria-labelledby={titreId} className="box-border flex min-w-0 flex-col rounded-2xl border border-bordure-carte bg-panneau px-[19px] py-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
        <span aria-hidden="true" className="flex size-14 flex-none flex-col items-center justify-center rounded-[14px] bg-coque">
          <span className="text-xs leading-4 font-medium tracking-[0.04em] text-ardoise">{mois}</span>
          <span className="text-xl leading-6 font-semibold text-encre">{jour}</span>
        </span>
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {s.parcours ? <Tag tone={TONS_PARCOURS[s.parcours.couleur] ?? "academique"}>{s.parcours.nomCourt}</Tag> : <Tag tone="enAttente">Tous les parcours</Tag>}
            <Tag tone="enAttente" icon={Video01Icon}>
              Session live
            </Tag>
            <span className="flex items-center gap-1 text-xs leading-[18px] text-discret">
              <Icon icon={UserMultipleIcon} size={14} />
              <span>{libelleInscriptions(s.inscriptions)}</span>
            </span>
          </div>
          <h3 id={titreId} className="m-0 text-base leading-6 font-semibold wrap-anywhere text-encre">
            {s.titre}
          </h3>
          <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1 text-[13px] leading-[18px] text-discret">
            <Info icon={Calendar03Icon}>{quandSession(s.debut, fuseau)}</Info>
            <Point />
            <Info icon={Video01Icon}>{s.plateforme}</Info>
            <Point />
            <Info icon={UserIcon}>{s.animateur}</Info>
          </div>
          {s.description && <p className="m-0 line-clamp-2 text-[13px] leading-5 wrap-anywhere text-discret">{s.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {annulee && <Tag tone="echoue">Annulée</Tag>}
          {reservee && !annulee && (
            <>
              <Tag tone="enAttente" icon={SquareLock02Icon}>
                Avec un abonnement
              </Tag>
              <Button variant="contour" asChild>
                <Link href="/abonnement/souscrire">Voir les abonnements</Link>
              </Button>
            </>
          )}
          {finie && !annulee && !reservee && (
            <Button variant="contour" asChild>
              <Link href={lienReplays}>Voir le replay</Link>
            </Button>
          )}
          {ouverte && enCours(s, maintenant) && <Tag tone="compteur">En cours</Tag>}
          {ouverte &&
            !reservee &&
            (commencee && s.lien ? (
              <Button asChild>
                <a href={s.lien} target="_blank" rel="noopener noreferrer">
                  Rejoindre
                </a>
              </Button>
            ) : (
              <Button variant={commencee ? "principal" : "contour"} onClick={rejoindreTropTot}>
                Rejoindre
              </Button>
            ))}
          {ouverte &&
            !reservee &&
            (s.inscrit ? (
              <>
                <InscriptionConfirmee />
                {!commencee && (
                  <>
                    <AjouterAgenda session={s} variante="discret" />
                    <Button variant="discret" loading={occupe} onClick={() => onDesinscrire(s)}>
                      Se désinscrire
                    </Button>
                  </>
                )}
              </>
            ) : (
              <Button variant={commencee ? "contour" : "principal"} loading={occupe} onClick={() => onInscrire(s)}>
                Je m’inscris
              </Button>
            ))}
        </div>
      </div>
      {ouverte && attente && !(commencee && s.lien) && (
        <p role="status" className="m-0 mt-4 rounded-champ bg-coque px-3.5 py-2.5 text-[13px] leading-5 text-texte">
          {attente}
        </p>
      )}
    </article>
  );
}
