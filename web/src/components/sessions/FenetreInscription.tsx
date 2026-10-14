"use client";

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { fichierIcs } from "@/lib/sessions/agenda";
import { phraseSession } from "@/lib/sessions/regles";
import type { SessionCarte } from "@/lib/sessions/types";

/** L'adresse de la page Événements, pour l'agenda : le lien du live n'est pas encore connu à l'inscription. */
const adresseEvenements = () => (typeof window === "undefined" ? "/evenements" : `${window.location.origin}/evenements`);

/**
 * « Inscription confirmée » (design NdEvenements, « Vous êtes inscrite » en version neutre) : le rappel, et « Ajouter à
 * mon agenda », qui télécharge un fichier .ics.
 */
export function FenetreInscription({ session, onFermer }: { session: SessionCarte | null; onFermer: () => void }) {
  const ics = session ? fichierIcs(session, adresseEvenements(), new Date()) : "";
  return (
    <Dialog
      open={session !== null}
      onOpenChange={(ouverte) => !ouverte && onFermer()}
      title="Inscription confirmée"
      icon={CheckmarkCircle02Icon}
      iconTone="reussite"
      description={
        session
          ? `${session.titre}, ${phraseSession(session.debut)}, sur ${session.plateforme}. Un rappel vous sera envoyé la veille et 1 h avant.`
          : undefined
      }
      footer={
        <>
          <Button variant="contour" asChild>
            <a href={`data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`} download="etudium-session.ics">
              Ajouter à mon agenda
            </a>
          </Button>
          <Button onClick={onFermer}>Fermer</Button>
        </>
      }
    />
  );
}
