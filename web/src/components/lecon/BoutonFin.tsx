"use client";

import { useTransition } from "react";
import Link from "next/link";
import { CheckmarkCircle02Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { terminerLecon } from "@/lib/lecon/actions";
import { useEtatLecon } from "./EtatLecon";

type Props = {
  leconId: string;
  /** Ordinateur : dans la ligne de navigation (NdLecon §2.6). Téléphone : dans la barre basse (NdMobLecon §3.8). */
  variante: "ordinateur" | "telephone";
  /** Adresse de la leçon suivante (téléphone : le bouton y mène une fois la leçon terminée). */
  suivante?: string;
};

const ECHEC = "La leçon n’a pas pu être marquée comme terminée. Réessayez.";
const AIDE = "text-xs leading-[18px] text-discret";

/**
 * « Marquer comme terminée » (spec Q3) : une leçon sans vidéo se termine par ce bouton ; une leçon vidéo se termine en
 * la regardant, et le bouton reste grisé jusque-là. Rien pour un visiteur (aucune progression à enregistrer).
 */
export function BoutonFin({ leconId, variante, suivante }: Props) {
  const etat = useEtatLecon();
  const { toast } = useToast();
  const [enCours, demarrer] = useTransition();
  const telephone = variante === "telephone";
  // Téléphone : le texte peut passer sur deux lignes (bouton de 48 px), pour tenir à 320 px à côté de « Leçon précédente ».
  const taille = telephone ? "h-12 w-full px-2.5 text-center leading-[18px] whitespace-normal" : "";

  const lienSuivante = suivante && (
    <Link href={suivante} className={cn(buttonVariants(), taille)}>
      Leçon suivante
    </Link>
  );
  if (!etat?.actif) return telephone ? lienSuivante || null : null;
  if (etat.terminee && telephone && lienSuivante) return lienSuivante;
  if (etat.terminee) {
    return (
      <span role="status" className={cn(buttonVariants({ variant: "gris" }), "cursor-default hover:bg-coque", taille)}>
        <Icon icon={CheckmarkCircle02Icon} size={18} />
        <span>Leçon terminée</span>
      </span>
    );
  }

  const attendreVideo = etat.avecVideo;
  const aide = attendreVideo ? `Regardez au moins ${etat.seuil} % de la vidéo` : null;
  const bouton = (
    <button
      type="button"
      disabled={attendreVideo || enCours}
      aria-busy={enCours || undefined}
      onClick={() =>
        demarrer(async () => {
          try {
            const reponse = await terminerLecon(leconId);
            if (reponse.ok) etat.marquerTerminee();
            else toast({ tone: "erreur", title: reponse.erreur });
          } catch {
            // Coupure réseau : on le dit, au lieu de l'écran d'erreur.
            toast({ tone: "erreur", title: ECHEC });
          }
        })
      }
      className={cn(buttonVariants(), taille)}
    >
      {!telephone && <Icon icon={Tick02Icon} size={18} />}
      <span>Marquer comme terminée</span>
    </button>
  );
  if (!aide) return bouton;
  return (
    <span className={cn("flex flex-col gap-1", telephone ? "w-full items-stretch" : "items-end")}>
      {telephone && <span className={cn(AIDE, "text-center")}>{aide}</span>}
      {bouton}
      {!telephone && <span className={AIDE}>{aide}</span>}
    </span>
  );
}
