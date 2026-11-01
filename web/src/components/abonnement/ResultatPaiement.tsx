"use client";

import Link from "next/link";
import { Alert02Icon, AlertCircleIcon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { dateLongue } from "@/lib/abonnement/regles";
import type { CartePaiement, EtapePaiement } from "@/lib/abonnement/types";

type Resultat = Extract<EtapePaiement, { etat: "reussi" | "echoue" | "expire" }>;

type Props = {
  resultat: Resultat;
  occupe: boolean;
  onFermer: () => void;
  onReessayer: () => void;
  onRecommencer: () => void;
  /** Élément qui reprend le focus après « Changer de numéro » (le champ du numéro). */
  champNumero: () => HTMLElement | null | undefined;
};

/** « Votre abonnement Standard est actif jusqu’au 1er mai 2027. » */
export const phraseActif = (p: CartePaiement) =>
  p.abonnement ? `Votre abonnement ${p.formule.nom} est actif jusqu’au ${dateLongue(p.abonnement.fin)}.` : `Votre abonnement ${p.formule.nom} est actif.`;

/** Le résultat du paiement (NdPaiementReussi, NdPaiementEchoue) ; une demande expirée se recommence. */
export function ResultatPaiement({ resultat, occupe, onFermer, onReessayer, onRecommencer, champNumero }: Props) {
  const fermer = (ouverte: boolean) => !ouverte && onFermer();
  if (resultat.etat === "reussi") {
    const numero = resultat.paiement.numeroRecu;
    return (
      <Dialog
        open
        onOpenChange={fermer}
        icon={CheckmarkCircle02Icon}
        iconTone="reussite"
        title="Paiement confirmé"
        description={phraseActif(resultat.paiement)}
        className="sm:max-w-[480px]"
        footer={
          <>
            {numero && (
              <Button asChild variant="contour">
                <Link href={`/abonnement/recus/${encodeURIComponent(numero)}`}>Voir le reçu</Link>
              </Button>
            )}
            <Button asChild>
              <Link href="/parcours">Commencer</Link>
            </Button>
          </>
        }
      />
    );
  }
  if (resultat.etat === "echoue") {
    return (
      <Dialog
        open
        onOpenChange={fermer}
        icon={AlertCircleIcon}
        iconTone="danger"
        title="Le paiement n’a pas abouti"
        description={
          resultat.incertain
            ? `${resultat.message} Si le montant a été débité, votre abonnement s’ouvrira automatiquement.`
            : `${resultat.message} Aucun montant n’a été débité.`
        }
        returnFocus={champNumero}
        footer={
          <>
            <Button variant="contour" onClick={onFermer}>
              Changer de numéro
            </Button>
            <Button onClick={onReessayer} loading={occupe}>
              Réessayer
            </Button>
          </>
        }
      />
    );
  }
  return (
    <Dialog
      open
      onOpenChange={fermer}
      icon={Alert02Icon}
      iconTone="attention"
      title="La demande a expiré"
      description="Aucun montant n’a été débité. Recommencez le paiement."
      footer={
        <Button onClick={onRecommencer} loading={occupe}>
          Recommencer
        </Button>
      }
    />
  );
}
