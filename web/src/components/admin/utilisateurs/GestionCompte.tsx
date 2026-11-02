"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { FenetresCompte, type FenetreCompte } from "./FenetresCompte";
import { Section } from "./Section";

type Props = {
  compte: { id: string; prenom: string; nom: string; nomCourt: string };
  droits: { renommer: boolean; supprimer: boolean };
};

/** La fiche d'un compte : « Modifier le nom » (un admin) et « Supprimer le compte » (le super admin) (lot 6 A). */
export function GestionCompte({ compte, droits }: Props) {
  const router = useRouter();
  const [fenetre, setFenetre] = useState<FenetreCompte>(null);
  if (!droits.renommer && !droits.supprimer) return null;
  return (
    <Section titre="Gérer le compte">
      <div className="flex flex-wrap gap-2">
        {droits.renommer && (
          <Button type="button" variant="contour" onClick={() => setFenetre("renommer")}>
            Modifier le nom
          </Button>
        )}
        {droits.supprimer && (
          <Button type="button" variant="dangerDoux" onClick={() => setFenetre("supprimer")}>
            Supprimer le compte
          </Button>
        )}
      </div>
      <FenetresCompte
        compte={compte}
        fenetre={fenetre}
        onFenetreChange={setFenetre}
        onTermine={(quoi) => (quoi === "supprimer" ? router.push("/admin/utilisateurs") : router.refresh())}
      />
    </Section>
  );
}
