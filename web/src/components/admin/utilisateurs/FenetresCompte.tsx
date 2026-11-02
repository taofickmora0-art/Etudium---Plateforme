"use client";

import { useId, useState } from "react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Textarea } from "@/components/ui/Textarea";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { renommerCompte, supprimerCompte } from "@/lib/utilisateurs/actions";
import { MOTIF_MAX } from "@/lib/utilisateurs/regles";

export type FenetreCompte = "renommer" | "supprimer" | null;

const MOTIF_REQUIS = "Indiquez le motif de la suppression.";

type Props = {
  compte: { id: string; prenom: string; nom: string; nomCourt: string };
  fenetre: FenetreCompte;
  onFenetreChange: (fenetre: FenetreCompte) => void;
  /** Après un changement réussi (la liste se relit ; la fiche, supprimée, ramène à la liste). */
  onTermine?: (quoi: "renommer" | "supprimer") => void;
  retourFocus?: () => HTMLElement | null;
};

/**
 * « Modifier le nom » et « Supprimer ce compte ? » (lot 6 A, spec §3), partagées par le menu ⋮ de la liste et la fiche
 * d'un compte. La suppression dit ce qui part et ce qui reste, et demande le motif (au journal).
 */
export function FenetresCompte({ compte, fenetre, onFenetreChange, onTermine, retourFocus }: Props) {
  const { toast } = useToast();
  const ids = { prenom: useId(), nom: useId(), motif: useId() };
  const [prenom, setPrenom] = useState(compte.prenom);
  const [nom, setNom] = useState(compte.nom);
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | undefined>();

  const echec = (message?: string) => {
    setErreur(message);
    throw new Error(message);
  };
  const ouvrir = (quoi: FenetreCompte) => (ouvert: boolean) => {
    setErreur(undefined);
    onFenetreChange(ouvert ? quoi : null);
  };

  return (
    <>
      <ConfirmDialog
        open={fenetre === "renommer"}
        onOpenChange={ouvrir("renommer")}
        title="Modifier le nom"
        description="Le nom s’affiche sur le profil, dans la communauté et sur les prochains certificats."
        confirmLabel="Enregistrer"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={async () => {
          const reponse = await renommerCompte(compte.id, prenom, nom);
          if (!reponse.ok) return echec(reponse.message);
          toast({ tone: "reussite", title: "Nom modifié", description: `${prenom.trim()} ${nom.trim()}` });
          onTermine?.("renommer");
        }}
      >
        <div className="flex flex-col gap-3">
          <Field label="Prénom" htmlFor={ids.prenom}>
            <TextInput id={ids.prenom} value={prenom} onChange={(e) => setPrenom(e.target.value)} maxLength={60} autoComplete="off" />
          </Field>
          <Field label="Nom" htmlFor={ids.nom}>
            <TextInput id={ids.nom} value={nom} onChange={(e) => setNom(e.target.value)} maxLength={60} autoComplete="off" />
          </Field>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={fenetre === "supprimer"}
        onOpenChange={ouvrir("supprimer")}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer ce compte ?"
        description={`Le compte de ${compte.nomCourt}, sa progression, ses publications, ses messages et ses abonnements seront supprimés. Ses paiements et ses certificats déjà délivrés restent (les certificats restent vérifiables). Cette action est définitive.`}
        confirmLabel="Supprimer le compte"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={async () => {
          if (!motif.trim()) return echec(MOTIF_REQUIS);
          const reponse = await supprimerCompte(compte.id, motif);
          if (!reponse.ok) return echec(reponse.message);
          setMotif("");
          toast({ tone: "reussite", title: "Compte supprimé", description: `Le compte de ${compte.nomCourt} n’existe plus.` });
          onTermine?.("supprimer");
        }}
      >
        <Field label="Motif (visible par l’équipe)" htmlFor={ids.motif}>
          <Textarea id={ids.motif} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={MOTIF_MAX} rows={3} />
        </Field>
      </ConfirmDialog>
    </>
  );
}
