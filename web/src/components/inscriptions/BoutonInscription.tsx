"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { sInscrireFormation } from "@/lib/inscriptions/actions";

const ECHEC = "L’inscription n’a pas abouti. Réessayez.";

/**
 * « S’inscrire à ce cours » (spec du 2 novembre 2026, §5) : le bouton charge, puis « Inscription confirmée. » et la page se
 * relit (les cadenas tombent). Sur la fiche, il devient aussitôt « Commencer le cours » (`apres`, la première leçon) ;
 * sur une leçon fermée, il attend que la page relue ouvre la leçon. Un refus de la base s'annonce par un message.
 */
export function BoutonInscription({
  formationId,
  apres = null,
  taille = "lg",
  className,
}: {
  formationId: string;
  /** L'adresse de « Commencer le cours » une fois inscrit ; null : le bouton attend la page relue. */
  apres?: string | null;
  taille?: "sm" | "md" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [enCours, demarrer] = useTransition();
  const [inscrit, setInscrit] = useState(false);

  const inscrire = () =>
    demarrer(async () => {
      try {
        const reponse = await sInscrireFormation(formationId);
        if (!reponse.ok) {
          toast({ tone: "erreur", title: reponse.message });
          return;
        }
        setInscrit(true);
        toast({ tone: "reussite", title: "Inscription confirmée." });
        router.refresh();
      } catch {
        toast({ tone: "erreur", title: ECHEC });
      }
    });

  if (inscrit && apres) {
    return (
      <Button asChild size={taille} className={className}>
        <Link href={apres}>
          <span>Commencer le cours</span>
          <Icon icon={ArrowRight02Icon} size={taille === "sm" ? 16 : 20} />
        </Link>
      </Button>
    );
  }
  return (
    <Button size={taille} loading={enCours || inscrit} onClick={inscrire} className={className}>
      S’inscrire à ce cours
    </Button>
  );
}
