"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { ecrireAuFormateur } from "@/lib/formateurs/actions";

const ECHEC = "La conversation n’a pas pu s’ouvrir. Réessayez.";

/**
 * « Message » (spec du 2 novembre 2026, §5 et §6) : ouvre (ou retrouve) la conversation avec le formateur, puis mène à la
 * messagerie. Un refus (pas inscrit à une de ses formations, session expirée…) s'affiche sous le bouton. À n'afficher que
 * si le compte peut lui écrire (peutEcrire).
 */
export function BoutonMessageFormateur({ formateurId, taille = "md", className }: { formateurId: string; taille?: "sm" | "md" | "lg"; className?: string }) {
  const router = useRouter();
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const ecrire = () => {
    setErreur(null);
    demarrer(async () => {
      try {
        const reponse = await ecrireAuFormateur(formateurId);
        if (reponse.ok) router.push(`/messages?c=${encodeURIComponent(reponse.conversationId)}`);
        else setErreur(reponse.message);
      } catch {
        setErreur(ECHEC);
      }
    });
  };

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Button size={taille} iconLeft={BubbleChatIcon} loading={enCours} onClick={ecrire}>
        Message
      </Button>
      {erreur && (
        <p role="alert" className="m-0 text-[13px] leading-5 text-pretty text-erreur-texte">
          {erreur}
        </p>
      )}
    </div>
  );
}
