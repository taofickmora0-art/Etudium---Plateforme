"use client";

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { useFuseau } from "@/components/dates/useFuseau";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { quandSession } from "@/lib/sessions/regles";
import type { SessionCarte } from "@/lib/sessions/types";
import { AjouterAgenda, FichierAgenda } from "./AjouterAgenda";

/**
 * « Inscription confirmée » (design NdEvenements, « Vous êtes inscrite » en version neutre) : les rappels, « Ajouter à
 * mon agenda », qui ouvre Google Agenda, et le fichier .ics pour les autres agendas.
 */
export function FenetreInscription({ session, onFermer }: { session: SessionCarte | null; onFermer: () => void }) {
  const fuseau = useFuseau();
  return (
    <Dialog
      open={session !== null}
      onOpenChange={(ouverte) => !ouverte && onFermer()}
      title="Inscription confirmée"
      icon={CheckmarkCircle02Icon}
      iconTone="reussite"
      description={
        session
          ? `${session.titre}, ${quandSession(session.debut, fuseau, "phrase")}, sur ${session.plateforme}. Un rappel vous sera envoyé la veille, 1 h avant et 10 min avant.`
          : undefined
      }
      footer={
        <>
          {session && <AjouterAgenda session={session} />}
          <Button onClick={onFermer}>Fermer</Button>
        </>
      }
    >
      {session && (
        <p className="m-0 text-[13px] leading-5 text-discret">
          Apple Calendar ou Outlook : <FichierAgenda session={session} />
        </p>
      )}
    </Dialog>
  );
}
