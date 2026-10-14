"use client";

import { useId, useState } from "react";
import { Shield01Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { moment } from "@/lib/communaute/regles";
import { reglerAnalyse } from "@/lib/moderation/actions";
import type { EtatModeration } from "@/lib/moderation/types";

const JETONS: Record<EtatModeration["jeton"], string> = { reconnu: "reconnu", non_reconnu: "non reconnu", absent: "absent" };
const ECHEC = "L’opération n’a pas abouti. Réessayez.";

/**
 * Le bloc « Analyse automatique » de la file (spec de la modération, §5) : active ou non ; la clé de l'IA et le jeton
 * du serveur (présents, reconnus), jamais affichés ; activer quand les deux sont là, désactiver après confirmation.
 */
export function BlocAnalyse({ etat, maintenant }: { etat: EtatModeration; maintenant: Date }) {
  const { toast } = useToast();
  const titre = useId();
  const [active, setActive] = useState(etat.active);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [erreurConfirmation, setErreurConfirmation] = useState<string>();
  const activable = etat.cle && etat.jeton === "reconnu";

  async function activer() {
    setEnvoi(true);
    const reponse = await reglerAnalyse(true).catch(() => ({ ok: false as const, message: ECHEC }));
    setEnvoi(false);
    if (!reponse.ok) {
      setErreur(reponse.message);
      return;
    }
    setErreur(null);
    setActive(true);
    toast({ tone: "reussite", title: "Analyse automatique activée" });
  }

  async function desactiver() {
    const reponse = await reglerAnalyse(false).catch(() => ({ ok: false as const, message: ECHEC }));
    if (!reponse.ok) {
      setErreurConfirmation(reponse.message);
      throw new Error(reponse.message);
    }
    setActive(false);
    toast({ tone: "reussite", title: "Analyse automatique désactivée" });
  }

  return (
    <section aria-labelledby={titre} className="box-border flex min-w-0 flex-col gap-3 rounded-carte border border-bordure-carte bg-panneau px-5 py-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 id={titre} className="m-0 text-base leading-6 font-semibold text-encre">
            Analyse automatique
          </h2>
          {active && <Tag tone="valide">Active</Tag>}
        </div>
        {active ? (
          <Button variant="contour" size="sm" onClick={() => setConfirmation(true)}>
            Désactiver
          </Button>
        ) : (
          activable && (
            <Button size="sm" iconLeft={Shield01Icon} loading={envoi} onClick={() => void activer()}>
              Activer l’analyse automatique
            </Button>
          )
        )}
      </div>
      {active ? (
        <p className="m-0 text-sm leading-[22px] text-discret">
          {etat.derniereAnalyse
            ? `Chaque publication est vérifiée par l’IA. Dernière analyse : ${moment(etat.derniereAnalyse, maintenant)}.`
            : "Chaque publication est vérifiée par l’IA."}
        </p>
      ) : (
        <div className="flex flex-col gap-1 text-sm leading-[22px]">
          <p className="m-0 text-texte">Inactive : les publications paraissent sans vérification.</p>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-discret">
            <li>{`Clé de l’IA : ${etat.cle ? "présente" : "absente"}`}</li>
            <li>{`Jeton de modération : ${JETONS[etat.jeton]}`}</li>
          </ul>
          {!activable && <p className="m-0 text-discret">Suivez la section 25 du guide « Ce qui te revient ».</p>}
        </div>
      )}
      {active && etat.enAttente > 0 && (
        <Banner
          tone="attention"
          title={`${etat.enAttente} publication${etat.enAttente > 1 ? "s attendent" : " attend"} : l’analyse n’a pas pu les vérifier. Vérifiez la clé de l’IA.`}
        />
      )}
      {erreur && <Banner tone="erreur" title={erreur} />}
      <ConfirmDialog
        open={confirmation}
        onOpenChange={setConfirmation}
        tone="danger"
        title="Désactiver l’analyse automatique ?"
        description="Les publications paraîtront sans vérification."
        confirmLabel="Désactiver"
        errorMessage={erreurConfirmation}
        onConfirm={desactiver}
      />
    </section>
  );
}
