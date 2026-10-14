"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ESPACES_DU_ROLE, LIBELLES_ROLES, nomCourt, rolePrincipal } from "@/lib/utilisateurs/regles";
import type { CompteDetail } from "@/lib/utilisateurs/types";
import { FenetreRole } from "./FenetreRole";
import { Section } from "./Section";

type Props = {
  compte: CompteDetail;
  /** Le super admin seul change le rôle ; les autres le voient. */
  modifiable: boolean;
};

/**
 * Le rôle d'un compte (migration 0017) : un seul en plus d'étudiant, avec les espaces qu'il ouvre ; pour un formateur,
 * sa fiche formateur. Le super admin le change par la fenêtre « Changer le rôle de … ? ».
 */
export function RoleCompte({ compte, modifiable }: Props) {
  const [ouverte, setOuverte] = useState(false);
  const role = rolePrincipal(compte.roles);

  return (
    <Section titre="Rôle">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] leading-[22px] font-medium text-encre">{LIBELLES_ROLES[role]}</span>
        <span className="text-[13px] leading-5 text-discret">{ESPACES_DU_ROLE[role]}</span>
      </div>
      {compte.ficheFormateur && (
        <p className="m-0 text-sm leading-[22px] text-texte">
          Fiche formateur :{" "}
          <Link href={`/admin/formateurs/${compte.ficheFormateur.id}`} className="focus-etudium font-medium text-bleu underline-offset-2 hover:underline">
            {compte.ficheFormateur.nom}
          </Link>
        </p>
      )}
      {modifiable ? (
        <>
          <div>
            <Button type="button" variant="contour" onClick={() => setOuverte(true)}>
              Changer le rôle
            </Button>
          </div>
          <FenetreRole compte={{ id: compte.id, nomCourt: nomCourt(compte.prenom, compte.nom, compte.email), role }} ouverte={ouverte} onOuverteChange={setOuverte} />
        </>
      ) : (
        <p className="m-0 text-sm leading-[22px] text-discret">Seul le super admin change les rôles.</p>
      )}
    </Section>
  );
}
