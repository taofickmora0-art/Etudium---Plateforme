"use client";

import { useId } from "react";
import { Calendar03Icon, CheckmarkCircle02Icon, UserIcon, UserMultipleIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon, type IconSvgElement } from "@/components/ui/Icon";
import { Tag, type TagTone } from "@/components/ui/Tag";
import { dateSession, enCours, jourCarte, libelleInscriptions, terminee } from "@/lib/sessions/regles";
import type { SessionCarte } from "@/lib/sessions/types";
import { AjouterAgenda } from "./AjouterAgenda";

const TONS_PARCOURS: Record<string, TagTone> = { academique: "academique", digital: "digital", business: "business" };

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
};

/**
 * Une session (design NdEvenements) : le jour, le parcours, « Session live », les inscriptions, le titre, la date, la
 * plateforme, l'animateur. Rejoindre apparaît dès que la base livre le lien (10 min avant, jusqu'à la fin), pour tous.
 */
export function CarteSession({ session: s, maintenant, onInscrire, onDesinscrire, occupe = false }: Props) {
  const titreId = useId();
  const { mois, jour } = jourCarte(s.debut);
  const annulee = s.statut === "annulee";
  const finie = terminee(s, maintenant);
  const commencee = Date.parse(s.debut) <= maintenant.getTime();
  const ouverte = !annulee && !finie;

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
            <Info icon={Calendar03Icon}>{dateSession(s.debut)}</Info>
            <Point />
            <Info icon={Video01Icon}>{s.plateforme}</Info>
            <Point />
            <Info icon={UserIcon}>{s.animateur}</Info>
          </div>
          {s.description && <p className="m-0 line-clamp-2 text-[13px] leading-5 wrap-anywhere text-discret">{s.description}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {annulee && <Tag tone="echoue">Annulée</Tag>}
          {ouverte && enCours(s, maintenant) && <Tag tone="compteur">En cours</Tag>}
          {ouverte && s.lien && (
            <Button asChild>
              <a href={s.lien} target="_blank" rel="noopener noreferrer">
                Rejoindre
              </a>
            </Button>
          )}
          {ouverte &&
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
              <Button variant={s.lien ? "contour" : "principal"} loading={occupe} onClick={() => onInscrire(s)}>
                Je m’inscris
              </Button>
            ))}
        </div>
      </div>
    </article>
  );
}
