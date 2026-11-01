"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/Switch";
import { abonnementCourant, abonnerPush, desabonnerPush, etatDuPush, MESSAGES_PUSH, type EtatPush } from "@/lib/envois/abonnement-push";
import { enregistrerAppareil, retirerAppareil } from "@/lib/envois/actions";

const ECHEC = "Cet appareil n’a pas pu être enregistré. Réessayez.";
const sansAbonnement = () => () => {};

/**
 * « Notifications push » (profil, onglet Notifications) : allumé quand la préférence est active et que cet appareil est
 * abonné. Allumer demande l'autorisation, abonne l'appareil et l'enregistre ; éteindre le désabonne et le retire.
 * Quand le push n'est pas possible ici, l'interrupteur est désactivé et dit pourquoi.
 */
export function InterrupteurPush({ actif, onChange }: { actif: boolean; onChange: (valeur: boolean) => void }) {
  const cle = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  // Lu dans le navigateur à chaque rendu (l'autorisation peut changer) ; null au rendu serveur.
  const etat = useSyncExternalStore<EtatPush | null>(sansAbonnement, () => etatDuPush(cle), () => null);
  const [abonne, setAbonne] = useState<boolean | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (etat !== "possible") return;
    let vivant = true;
    void abonnementCourant().then((adresse) => {
      if (vivant) setAbonne(adresse !== null);
    });
    return () => {
      vivant = false;
    };
  }, [etat]);

  async function basculer(valeur: boolean) {
    if (!cle) return;
    setErreur(null);
    setOccupe(true);
    try {
      if (valeur) {
        const r = await abonnerPush(cle);
        if (!r.ok) return setErreur(r.message);
        const e = await enregistrerAppareil(r.abonnement).catch(() => ({ ok: false as const, message: ECHEC }));
        if (!e.ok) {
          // Un appareil abonné mais inconnu de la base ne recevrait rien : on le désabonne.
          await desabonnerPush();
          setAbonne(false);
          return setErreur(e.message);
        }
        setAbonne(true);
        onChange(true);
      } else {
        const adresse = await desabonnerPush();
        setAbonne(false);
        if (adresse) await retirerAppareil(adresse).catch(() => null);
        onChange(false);
      }
    } finally {
      setOccupe(false);
    }
  }

  const possible = etat === "possible";
  return (
    <div className="flex flex-col">
      <Switch
        label="Notifications push"
        description={etat && etat !== "possible" ? MESSAGES_PUSH[etat] : "Sur cet appareil"}
        checked={possible && actif && abonne === true}
        disabled={!possible || abonne === null || occupe}
        onCheckedChange={(v) => void basculer(v)}
        className="min-h-11 py-2.5"
      />
      {possible && erreur && (
        <p role="alert" className="m-0 pb-2 text-[13px] leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
    </div>
  );
}
