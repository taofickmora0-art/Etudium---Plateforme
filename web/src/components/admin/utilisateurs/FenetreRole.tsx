"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { useToast } from "@/components/ui/Toast";
import type { Role } from "@/lib/auth/permissions";
import { changerRoles } from "@/lib/utilisateurs/actions";
import { LIBELLES_ROLES, refusRoles, ROLES_EQUIPE, rolesOrdonnes } from "@/lib/utilisateurs/regles";

const ECHEC = "Les rôles n’ont pas pu être changés. Réessayez.";

type Props = {
  compte: { id: string; nomCourt: string; roles: Role[] };
  ouverte: boolean;
  onOuverteChange: (ouverte: boolean) => void;
  /** Après un changement réussi (la liste se relit). */
  onTermine?: () => void;
  /** L'élément qui reprend le focus à la fermeture (le bouton du menu de la ligne, dans la liste). */
  retourFocus?: () => HTMLElement | null;
};

const equipeDe = (roles: Role[]) => roles.find((r) => ROLES_EQUIPE.includes(r)) ?? "";

/**
 * « Changer les rôles de … ? » (migration 0079) : étudiant, formateur, ou les deux, et au plus un rôle de l'équipe. Le
 * rôle Formateur crée sa fiche formateur ou lui rend la sienne : rien à choisir. Partagée par la liste des comptes
 * (menu ⋮) et la fiche d'un compte ; la base revérifie tout et son refus est affiché tel quel.
 */
export function FenetreRole({ compte, ouverte, onOuverteChange, onTermine, retourFocus }: Props) {
  const { toast } = useToast();
  const [etudiant, setEtudiant] = useState(compte.roles.includes("etudiant"));
  const [formateur, setFormateur] = useState(compte.roles.includes("formateur"));
  const [equipe, setEquipe] = useState<string>(equipeDe(compte.roles));
  const [erreur, setErreur] = useState<string | undefined>();

  const choisis = rolesOrdonnes([...(etudiant ? ["etudiant" as const] : []), ...(formateur ? ["formateur" as const] : []), ...(equipe ? [equipe as Role] : [])]);
  const refus = refusRoles(choisis);
  const inchange = choisis.join() === rolesOrdonnes(compte.roles).join();
  const remettre = () => {
    setEtudiant(compte.roles.includes("etudiant"));
    setFormateur(compte.roles.includes("formateur"));
    setEquipe(equipeDe(compte.roles));
    setErreur(undefined);
  };

  return (
    <ConfirmDialog
      open={ouverte}
      onOpenChange={(ouvrir) => {
        remettre();
        onOuverteChange(ouvrir);
      }}
      title={`Changer les rôles de ${compte.nomCourt} ?`}
      description="Étudiant, formateur, ou les deux ; et au plus un rôle de l’équipe."
      confirmLabel="Enregistrer les rôles"
      confirmDisabled={inchange || refus !== null}
      errorMessage={erreur}
      returnFocus={retourFocus}
      onConfirm={async () => {
        const reponse = await changerRoles(compte.id, choisis);
        if (!reponse.ok) {
          setErreur(reponse.message ?? ECHEC);
          throw new Error(reponse.message);
        }
        toast({ tone: "reussite", title: "Rôles changés", description: `${compte.nomCourt} : ${choisis.map((r) => LIBELLES_ROLES[r]).join(", ")}.` });
        onTermine?.();
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <Checkbox
            label={
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-encre">Étudiant</span>
                <span className="text-[13px] leading-5 text-discret">Espace étudiant : suit les formations.</span>
              </span>
            }
            checked={etudiant}
            onChange={(e) => setEtudiant(e.target.checked)}
          />
          <Checkbox
            label={
              <span className="flex min-w-0 flex-col">
                <span className="font-medium text-encre">Formateur</span>
                <span className="text-[13px] leading-5 text-discret">Espace formateur : crée et suit ses formations.</span>
              </span>
            }
            checked={formateur}
            onChange={(e) => setFormateur(e.target.checked)}
          />
        </div>
        <RadioGroup
          label="Équipe"
          showLabel
          name={`equipe-${compte.id}`}
          value={equipe}
          onValueChange={setEquipe}
          options={[{ value: "", label: "Aucun" }, ...ROLES_EQUIPE.map((r) => ({ value: r, label: LIBELLES_ROLES[r] }))]}
        />
        {refus && <p className="m-0 text-[13px] leading-5 text-erreur-texte">{refus}</p>}
      </div>
    </ConfirmDialog>
  );
}
