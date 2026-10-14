"use client";

import { useState } from "react";
import { Calendar03Icon, UserIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { sinscrire } from "@/lib/sessions/actions";
import { dateSession, jourCarte, libelleInscriptions, terminee } from "@/lib/sessions/regles";
import type { ProchaineSession } from "@/lib/sessions/types";
import { InscriptionConfirmee } from "./CarteSession";
import { FenetreInscription } from "./FenetreInscription";

/**
 * La carte « Prochaine session live » de l'accueil (design NdAccueil) : la plus proche de ses inscriptions, sinon la
 * prochaine session ; les initiales des premiers inscrits ; s'inscrire, ou rejoindre quand le lien s'ouvre.
 */
export function CarteProchaineSession({ session }: { session: ProchaineSession }) {
  const [s, setS] = useState(session);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmee, setConfirmee] = useState(false);
  const { mois, jour } = jourCarte(s.debut);
  const ouverte = !terminee(s, new Date());

  async function inscrire() {
    setEnvoi(true);
    const reponse = await sinscrire(s.id);
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.message ?? null);
      return;
    }
    setErreur(null);
    setS((actuelle) => ({ ...actuelle, inscrit: true, inscriptions: actuelle.inscriptions + 1 }));
    setConfirmee(true);
  }

  return (
    <div className="box-border flex min-w-0 flex-col gap-4 rounded-2xl border border-bordure-carte bg-panneau p-5">
      <div className="flex min-w-0 items-start gap-4">
        <span aria-hidden="true" className="flex size-14 flex-none flex-col items-center justify-center rounded-[14px] bg-coque">
          <span className="text-xs leading-4 font-medium tracking-[0.04em] text-ardoise">{mois}</span>
          <span className="text-xl leading-6 font-semibold text-encre">{jour}</span>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 text-base leading-6 font-semibold wrap-anywhere text-encre">{s.titre}</h3>
          <span className="flex items-center gap-1 text-[13px] leading-[18px] text-discret">
            <Icon icon={Calendar03Icon} size={14} className="flex-none" />
            {dateSession(s.debut)}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] leading-[18px] text-discret">
            <span className="flex items-center gap-1">
              <Icon icon={Video01Icon} size={14} />
              {s.plateforme}
            </span>
            <span className="flex min-w-0 items-center gap-1">
              <Icon icon={UserIcon} size={14} className="flex-none" />
              <span className="wrap-anywhere">{s.animateur}</span>
            </span>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          {s.initiales.length > 0 && (
            <span className="flex -space-x-2">
              {s.initiales.map((initiales, i) => (
                <Avatar key={`${initiales}-${i}`} initials={initiales} size={28} />
              ))}
            </span>
          )}
          <span className="text-xs leading-[18px] text-discret">{libelleInscriptions(s.inscriptions)}</span>
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {ouverte && s.lien && (
            <Button asChild>
              <a href={s.lien} target="_blank" rel="noopener noreferrer">
                Rejoindre
              </a>
            </Button>
          )}
          {ouverte &&
            (s.inscrit ? (
              <InscriptionConfirmee />
            ) : (
              <Button variant={s.lien ? "contour" : "principal"} loading={envoi} onClick={() => void inscrire()}>
                Je m’inscris à la session
              </Button>
            ))}
        </span>
      </div>
      {erreur && <p className="m-0 text-sm leading-5 text-erreur-texte">{erreur}</p>}
      <FenetreInscription session={confirmee ? s : null} onFermer={() => setConfirmee(false)} />
    </div>
  );
}
