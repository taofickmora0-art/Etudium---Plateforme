"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { montantFcfa } from "@/lib/abonnement/regles";
import type { CartePaiement } from "@/lib/abonnement/types";

/** « 2:47 » : le temps qui reste avant la fin de l'attente. */
const minutesSecondes = (ms: number) => {
  const secondes = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(secondes / 60)}:${String(secondes % 60).padStart(2, "0")}`;
};

/**
 * L'attente de la validation sur le téléphone (NdPaiementAttente ; feuille du bas au téléphone, NdMobPaiementAttente) :
 * le montant, le numéro masqué, et le compte à rebours. Le suivi lui-même est mené par la souscription.
 */
export function AttentePaiement({ paiement, finAttente, onFermer }: { paiement: CartePaiement; finAttente: string; onFermer: () => void }) {
  const [maintenant, setMaintenant] = useState(() => Date.now());
  useEffect(() => {
    const minuterie = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(minuterie);
  }, []);
  const reste = Date.parse(finAttente) - maintenant;

  return (
    <Dialog
      open
      onOpenChange={(ouverte) => !ouverte && onFermer()}
      dismissible={false}
      title="Confirmez sur votre téléphone"
      description={`Une demande de ${montantFcfa(paiement.montant)} a été envoyée au ${paiement.telephoneMasque ?? "numéro indiqué"}. Saisissez votre code secret Mobile Money pour valider.`}
      footer={
        <Button variant="contour" onClick={onFermer}>
          Fermer
        </Button>
      }
    >
      <div className="mt-[18px] flex items-center gap-3 rounded-bouton bg-page px-4 py-3.5 max-sm:mt-4">
        <Spinner size={22} />
        <p className="m-0 flex-1 text-sm leading-[22px] font-medium text-encre">En attente de votre confirmation…</p>
        <p className="m-0 text-sm leading-[22px] text-discret tabular-nums" aria-label={`Temps restant : ${minutesSecondes(reste)}`}>
          {minutesSecondes(reste)}
        </p>
      </div>
    </Dialog>
  );
}
