"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { useToast } from "@/components/ui/Toast";
import type { Role } from "@/lib/auth/permissions";
import { changerRole } from "@/lib/utilisateurs/actions";
import { ESPACES_DU_ROLE, estRole, LIBELLES_ROLES, ROLES_ORDONNES } from "@/lib/utilisateurs/regles";

const ECHEC = "Le rôle n’a pas pu être changé. Réessayez.";

type Props = {
  compte: { id: string; nomCourt: string; role: Role };
  ouverte: boolean;
  onOuverteChange: (ouverte: boolean) => void;
  /** Après un changement réussi (la liste se relit). */
  onTermine?: () => void;
  /** L'élément qui reprend le focus à la fermeture (le bouton du menu de la ligne, dans la liste). */
  retourFocus?: () => HTMLElement | null;
};

/**
 * « Changer le rôle de … ? » (migration 0017) : un seul rôle en plus d'étudiant, chacun avec ses espaces. Le rôle
 * Formateur crée sa fiche formateur ou lui rend la sienne : rien à choisir. Partagée par la liste des comptes (menu ⋮)
 * et la fiche d'un compte ; la base revérifie tout et son refus est affiché tel quel.
 */
export function FenetreRole({ compte, ouverte, onOuverteChange, onTermine, retourFocus }: Props) {
  const { toast } = useToast();
  const [choix, setChoix] = useState<Role | null>(null);
  const [erreur, setErreur] = useState<string | undefined>();
  const role = choix ?? compte.role;

  return (
    <ConfirmDialog
      open={ouverte}
      onOpenChange={(ouvrir) => {
        setChoix(null);
        setErreur(undefined);
        onOuverteChange(ouvrir);
      }}
      title={`Changer le rôle de ${compte.nomCourt} ?`}
      description="Un seul rôle, en plus de l’espace étudiant que garde chaque compte."
      confirmLabel="Changer le rôle"
      confirmDisabled={role === compte.role}
      errorMessage={erreur}
      returnFocus={retourFocus}
      onConfirm={async () => {
        const reponse = await changerRole(compte.id, role);
        if (!reponse.ok) {
          setErreur(reponse.message ?? ECHEC);
          throw new Error(reponse.message);
        }
        toast({ tone: "reussite", title: "Rôle changé", description: `${compte.nomCourt} : ${LIBELLES_ROLES[role]}.` });
        onTermine?.();
      }}
    >
      <RadioGroup
        label="Rôle"
        name={`role-${compte.id}`}
        value={role}
        onValueChange={(valeur) => {
          if (estRole(valeur)) setChoix(valeur);
        }}
        options={ROLES_ORDONNES.map((r) => ({
          value: r,
          label: (
            <span className="flex min-w-0 flex-col">
              <span className="font-medium text-encre">{LIBELLES_ROLES[r]}</span>
              <span className="text-[13px] leading-5 text-discret">{ESPACES_DU_ROLE[r]}</span>
            </span>
          ),
        }))}
      />
    </ConfirmDialog>
  );
}
