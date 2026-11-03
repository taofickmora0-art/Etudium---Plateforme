"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tag } from "@/components/ui/Tag";
import { Heading } from "@/components/ui/Text";
import { activerPaiements, desactiverPaiements } from "@/lib/admin/paiements/actions";
import type { EtatReglage } from "@/lib/admin/paiements/types";

const AJOUTER_CLE = "Ajoutez PAYIZ_CLE_SECRETE aux variables d’environnement du site, puis redéployez-le.";
const NOTE = "m-0 text-sm leading-[22px] text-discret";

/**
 * Le réglage « Paiements activés » (lot 2, spec §6) : l'activation pose en base l'empreinte du jeton du serveur. Tant
 * que les paiements sont désactivés, « Payer » affiche « Les paiements ouvrent bientôt. ». Ni la clé ni le jeton ne
 * sont montrés : seulement leur état.
 */
export function ReglagePaiements({ etat, ecriture }: { etat: EtatReglage; ecriture: boolean }) {
  const router = useRouter();
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmer, setConfirmer] = useState(false);
  const pret = etat.cle !== "absente" && etat.jeton !== "absent";
  const reconnu = etat.jeton === "reconnu";

  async function activer() {
    setOccupe(true);
    setErreur(null);
    const r = await activerPaiements();
    setOccupe(false);
    if (r.ok) router.refresh();
    else setErreur(r.message);
  }

  return (
    <section aria-labelledby="titre-reglage-paiements" className="flex flex-col gap-3 rounded-carte border border-bordure-carte px-[19px] py-[18px] max-sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="card" as="h2">
              <span id="titre-reglage-paiements">Paiements Mobile Money</span>
            </Heading>
            <Tag tone={etat.ouverts ? "reussi" : "enAttente"}>{etat.ouverts ? "Paiements activés" : "Paiements désactivés"}</Tag>
          </div>
          <p className={NOTE}>{etat.cle === "absente" ? "Clé Payiz : absente" : `Clé Payiz : mode ${etat.cle === "reel" ? "réel" : "test"}`}</p>
          {!etat.ouverts && <p className={NOTE}>Les étudiants voient « Les paiements ouvrent bientôt. ».</p>}
          {!etat.webhook && <p className={NOTE}>Notifications Payiz : non configurées.</p>}
        </div>
        {ecriture && !etat.ouverts && (
          <Button onClick={() => void activer()} disabled={!pret} loading={occupe}>
            Activer les paiements
          </Button>
        )}
        {ecriture && etat.ouverts && reconnu && (
          <Button variant="contour" onClick={() => setConfirmer(true)}>
            Désactiver les paiements
          </Button>
        )}
      </div>
      {etat.ouverts && !reconnu && (
        <Banner
          tone="attention"
          title="La clé Payiz a changé : cliquez sur « Réactiver » pour que les paiements soient de nouveau confirmés."
          action={
            ecriture && pret ? (
              <Button size="sm" variant="contour" onClick={() => void activer()} loading={occupe}>
                Réactiver
              </Button>
            ) : undefined
          }
        />
      )}
      {!pret && <p className={NOTE}>{AJOUTER_CLE}</p>}
      {erreur && (
        <p role="alert" className="m-0 text-sm leading-5 text-erreur-texte">
          {erreur}
        </p>
      )}
      <ConfirmDialog
        open={confirmer}
        onOpenChange={setConfirmer}
        title="Désactiver les paiements ?"
        description="Les étudiants ne pourront plus payer. Les abonnements en cours ne changent pas."
        confirmLabel="Désactiver"
        onConfirm={async () => {
          const r = await desactiverPaiements();
          if (!r.ok) throw new Error(r.message);
          router.refresh();
        }}
      />
    </section>
  );
}
