"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { creerPin, oublierPin } from "@/lib/resultats/actions";
import { CadrePorte } from "./CadrePorte";
import { NouveauCode } from "./NouveauCode";

/**
 * Le retour d'un « Code oublié ? » (après la reconnexion) : rien ne part sans un geste. Le nouveau code efface l'ancien
 * (la base exige une connexion de moins de 10 minutes), puis il est enregistré.
 */
export function ApresOubli({ pin }: { pin: boolean }) {
  const router = useRouter();
  const sortir = () => router.replace("/mes-resultats");
  return (
    <CadrePorte titre="Crée ton nouveau code" texte="Il remplacera l’ancien.">
      <NouveauCode
        enregistrer={async (code) => {
          if (pin) {
            const efface = await oublierPin();
            if (!efface.ok) return efface;
          }
          return creerPin(code);
        }}
        onFait={sortir}
        secondaire={
          <Button variant="contour" onClick={sortir}>
            Annuler
          </Button>
        }
      />
    </CadrePorte>
  );
}
