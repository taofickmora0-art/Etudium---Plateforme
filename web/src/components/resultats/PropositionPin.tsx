"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { creerPin, passerProposition } from "@/lib/resultats/actions";
import { CadrePorte } from "./CadrePorte";
import { NouveauCode } from "./NouveauCode";

/** Le premier accès sans code : le proposer (facultatif). « Plus tard » ne le repropose plus ; « Sécurité » le garde à portée. */
export function PropositionPin() {
  const [creation, setCreation] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  if (creation) {
    return (
      <CadrePorte titre="Crée ton code" texte="Il te sera demandé à chaque visite de « Mes résultats ».">
        <NouveauCode
          enregistrer={(code) => creerPin(code)}
          secondaire={
            <Button variant="contour" onClick={() => setCreation(false)}>
              Retour
            </Button>
          }
        />
      </CadrePorte>
    );
  }

  return (
    <CadrePorte
      titre="Protège tes résultats"
      texte="Ajoute un code à 4 chiffres : il sera demandé à chaque visite de cet espace. C’est facultatif, et tu pourras le changer ou le retirer dans « Sécurité »."
    >
      <div className="flex flex-wrap justify-center gap-2 max-sm:w-full max-sm:flex-col-reverse">
        <Button
          variant="contour"
          loading={envoi}
          onClick={async () => {
            setEnvoi(true);
            // Accepté, la page se recharge d'elle-même (l'action rafraîchit).
            if (!(await passerProposition()).ok) setEnvoi(false);
          }}
        >
          Plus tard
        </Button>
        <Button onClick={() => setCreation(true)} disabled={envoi}>
          Créer mon code
        </Button>
      </div>
    </CadrePorte>
  );
}
