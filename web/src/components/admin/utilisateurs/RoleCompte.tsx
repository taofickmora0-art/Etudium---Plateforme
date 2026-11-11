"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { espacesDesRoles, libelleRoles, nomCourt } from "@/lib/utilisateurs/regles";
import type { CompteDetail } from "@/lib/utilisateurs/types";
import { FenetreRole } from "./FenetreRole";
import { Section } from "./Section";

type Props = {
  compte: CompteDetail;
  /** Le super admin seul change les rôles ; les autres les voient. */
  modifiable: boolean;
};

/**
 * Les rôles d'un compte (migration 0079) : étudiant, formateur, ou les deux, et au plus un rôle de l'équipe, avec les
 * espaces qu'ils ouvrent ; pour un formateur, sa fiche formateur. Le super admin les change par « Changer les rôles ».
 */
export function RoleCompte({ compte, modifiable }: Props) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <Section titre="Rôles">
      <div className="flex flex-col gap-1">
        <span className="text-[15px] leading-[22px] font-medium text-encre">{libelleRoles(compte.roles)}</span>
        <span className="text-[13px] leading-5 text-discret">{espacesDesRoles(compte.roles)}</span>
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
              Changer les rôles
            </Button>
          </div>
          {/* Remontée quand les rôles changent : la fenêtre repart des rôles enregistrés. */}
          <FenetreRole
            key={compte.roles.join()}
            compte={{ id: compte.id, nomCourt: nomCourt(compte.prenom, compte.nom, compte.email), roles: compte.roles }}
            ouverte={ouverte}
            onOuverteChange={setOuverte}
          />
        </>
      ) : (
        <p className="m-0 text-sm leading-[22px] text-discret">Seul le super admin change les rôles.</p>
      )}
    </Section>
  );
}
