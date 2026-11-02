"use client";

import { useState } from "react";
import Link from "next/link";
import { UserIcon, Video01Icon } from "@hugeicons/core-free-icons";
import { useFuseau } from "@/components/dates/useFuseau";
import { InscriptionConfirmee } from "@/components/sessions/CarteSession";
import { Avatar, AvatarGroup } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { sinscrire } from "@/lib/sessions/actions";
import { jourCarte, quandSession } from "@/lib/sessions/regles";
import type { ProchaineSession } from "@/lib/sessions/types";

/**
 * « Prochaine session live » du tableau de bord (NdAccueil) : le jour, le titre, la date à l'heure de l'appareil, la
 * plateforme, l'animateur, les premiers inscrits, et l'inscription d'un clic. Réservée aux abonnés : « Voir les
 * abonnements » à la place.
 */
export function ProchaineSessionBloc({ session }: { session: ProchaineSession }) {
  const fuseau = useFuseau();
  const [inscrit, setInscrit] = useState(session.inscrit);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const { mois, jour } = jourCarte(session.debut, fuseau);
  const inscriptions = session.inscriptions + (inscrit && !session.inscrit ? 1 : 0);

  async function inscrire() {
    setOccupe(true);
    const reponse = await sinscrire(session.id);
    setOccupe(false);
    if (!reponse.ok) {
      setErreur(reponse.message ?? "L’inscription n’a pas pu être enregistrée. Réessayez.");
      return;
    }
    setErreur(null);
    setInscrit(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="flex size-14 flex-none flex-col items-center justify-center rounded-[14px] bg-coque max-sm:size-12">
          <span className="text-xs leading-4 font-medium tracking-[0.04em] text-ardoise uppercase max-sm:text-[11px]">{mois}</span>
          <span className="text-xl leading-6 font-semibold text-encre max-sm:text-lg">{jour}</span>
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="m-0 text-base leading-6 font-semibold wrap-anywhere text-encre max-sm:text-[15px] max-sm:leading-[22px]">{session.titre}</h3>
          <p className="m-0 text-[13px] leading-5 text-texte">{quandSession(session.debut, fuseau, "phrase")}</p>
          <p className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-5 text-discret">
            <span className="flex items-center gap-1">
              <Icon icon={Video01Icon} size={14} />
              {session.plateforme}
            </span>
            <span className="flex items-center gap-1">
              <Icon icon={UserIcon} size={14} />
              {session.animateur}
            </span>
          </p>
        </div>
      </div>
      {inscriptions > 0 && (
        <div className="flex items-center gap-2.5">
          {session.initiales.length > 0 && (
            <AvatarGroup>
              {session.initiales.slice(0, 3).map((i, n) => (
                <Avatar key={`${i}-${n}`} initials={i} size={32} />
              ))}
            </AvatarGroup>
          )}
          <span className="text-[13px] leading-5 text-discret">{`+${inscriptions.toLocaleString("fr-FR")} inscrit${inscriptions > 1 ? "s" : ""}`}</span>
        </div>
      )}
      {session.reservee ? (
        <Button variant="contour" asChild className="w-full">
          <Link href="/abonnement/souscrire">Voir les abonnements</Link>
        </Button>
      ) : inscrit ? (
        <InscriptionConfirmee />
      ) : (
        <Button variant="gris" className="w-full" loading={occupe} onClick={inscrire}>
          Je m’inscris à la session
        </Button>
      )}
      {erreur && (
        <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
    </div>
  );
}
