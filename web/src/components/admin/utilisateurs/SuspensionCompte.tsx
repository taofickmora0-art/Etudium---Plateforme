"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import { dateCourte, nomCourt } from "@/lib/utilisateurs/regles";
import type { CompteDetail } from "@/lib/utilisateurs/types";
import { FenetresSuspension, type FenetreSuspension } from "./FenetresSuspension";
import { Section } from "./Section";

type Props = {
  compte: CompteDetail;
  /** Ce que la personne connectée peut faire ici (droitsSurCompte) : sans droit, aucun bouton. */
  droits: { suspendre: boolean; reactiver: boolean };
};

/**
 * Suspension d'un compte (spec des utilisateurs, §3 et §4) : suspendre avec un motif facultatif (vu de l'équipe
 * seulement), puis réactiver. Un compte suspendu est déconnecté et n'a plus accès à rien ; ses données sont gardées.
 */
export function SuspensionCompte({ compte, droits }: Props) {
  const [fenetre, setFenetre] = useState<FenetreSuspension>(null);
  const { suspension } = compte;

  return (
    <Section titre="Suspension">
      {suspension ? (
        <div className="flex flex-col items-start gap-2">
          <Tag tone="echoue">Suspendu</Tag>
          <p className="m-0 text-sm leading-[22px] text-texte">
            {`Suspendu depuis le ${dateCourte(suspension.depuis)}${suspension.parNom ? `, par ${suspension.parNom}` : ""}`}
          </p>
          {suspension.motif && <p className="m-0 text-sm leading-[22px] break-words text-discret">{suspension.motif}</p>}
        </div>
      ) : (
        <p className="m-0 text-sm leading-[22px] text-texte">Ce compte est actif.</p>
      )}
      {droits.suspendre && !suspension && (
        <div>
          <Button type="button" variant="dangerDoux" onClick={() => setFenetre("suspendre")}>
            Suspendre le compte
          </Button>
        </div>
      )}
      {droits.reactiver && suspension && (
        <div>
          <Button type="button" variant="contour" onClick={() => setFenetre("reactiver")}>
            Réactiver le compte
          </Button>
        </div>
      )}
      <FenetresSuspension compte={{ id: compte.id, nomCourt: nomCourt(compte.prenom, compte.nom, compte.email) }} fenetre={fenetre} onFenetreChange={setFenetre} />
    </Section>
  );
}
