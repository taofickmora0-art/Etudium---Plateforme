"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight01Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { buttonVariants } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { terminerLecon } from "@/lib/lecon/actions";
import { useEtatLecon } from "./EtatLecon";

type Props = {
  leconId: string;
  /** Ordinateur : la barre du haut et la ligne de navigation (NdLecon §2.6). Téléphone : la barre basse (NdMobLecon §3.8). */
  variante: "ordinateur" | "telephone";
  /** Adresse de la leçon suivante : le bouton y mène une fois la leçon terminée. */
  suivante?: string;
  /** Adresse de la formation : « Voir la formation » après la dernière leçon (ordinateur). */
  formation?: string;
};

const ECHEC = "La leçon n’a pas pu être marquée comme terminée. Réessayez.";
const AIDE = "text-xs leading-[18px] text-discret";

/**
 * « Terminer la leçon › » (refonte des formations, spec §1.2) : une leçon sans vidéo se termine par ce bouton, qui ouvre
 * aussitôt la suivante ; une leçon vidéo se termine en la regardant, et le bouton reste grisé jusqu'au seuil. Une fois
 * la leçon terminée, il devient « Leçon suivante › ». Pour un visiteur (rien à enregistrer), seulement ce lien.
 */
export function BoutonFin({ leconId, variante, suivante, formation }: Props) {
  const etat = useEtatLecon();
  const router = useRouter();
  const { toast } = useToast();
  const [enCours, demarrer] = useTransition();
  const telephone = variante === "telephone";
  // Téléphone : le texte peut passer sur deux lignes (bouton de 48 px), pour tenir à 320 px à côté de « Leçon précédente ».
  const taille = telephone ? "h-12 w-full px-2.5 text-center leading-[18px] whitespace-normal" : "";
  const fleche = !telephone && <Icon icon={ArrowRight01Icon} size={18} />;

  const lienSuivante = suivante && (
    <Link href={suivante} className={cn(buttonVariants(), taille)}>
      <span>Leçon suivante</span>
      {fleche}
    </Link>
  );
  if (!etat?.actif) return lienSuivante || null;
  if (etat.terminee && lienSuivante) return lienSuivante;
  if (etat.terminee) {
    // La dernière leçon : la formation n'est terminée que si toutes les autres le sont, la page du cours le dit.
    const fin = (
      <span role="status" className={cn(buttonVariants({ variant: "gris" }), "cursor-default hover:bg-coque", taille)}>
        <Icon icon={CheckmarkCircle02Icon} size={18} />
        <span>Dernière leçon terminée !</span>
      </span>
    );
    if (telephone || !formation) return fin;
    return (
      <span className="flex flex-wrap items-center justify-end gap-2">
        {fin}
        <Link href={formation} className={buttonVariants({ variant: "contour" })}>
          Voir la formation
        </Link>
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
            if (!reponse.ok) {
              toast({ tone: "erreur", title: reponse.erreur });
              return;
            }
            etat.marquerTerminee();
            if (suivante) router.push(suivante);
          } catch {
            // Coupure réseau : on le dit, au lieu de l'écran d'erreur.
            toast({ tone: "erreur", title: ECHEC });
          }
        })
      }
      className={cn(buttonVariants(), taille)}
    >
      <span>Terminer la leçon</span>
      {fleche}
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
