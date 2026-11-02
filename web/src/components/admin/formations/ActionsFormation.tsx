"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dialog, DialogClose } from "@/components/ui/Dialog";
import { useToast } from "@/components/ui/Toast";
import { deleteFormation, setStatutFormation } from "@/lib/admin/actions";
import { texteDesactivation } from "@/lib/admin/desactivation";
import type { EtatFormation } from "@/lib/contenus/etat";
import type { StatutFormation } from "@/lib/contenus/libelles";
import { FenetreRenvoyerAuFormateur } from "../RenvoyerAuFormateur";

// Les actions sur l'état d'une formation et leurs fenêtres de confirmation, partagées par l'onglet « Publication » de
// sa fiche (des boutons) et par le menu ⋮ de sa carte dans la liste (demande du 2 novembre 2026) : mêmes règles, mêmes
// textes, mêmes messages.

export type ActionFormation = "publier" | "renvoyer" | "archiver" | "desactiver" | "reactiver" | "republier" | "supprimer";

/** La fenêtre ouverte : celle d'une action, ou l'explication d'une suppression refusée (formation déjà publiée). */
export type FenetreFormation = ActionFormation | "suppressionImpossible" | null;

type Resultat = { ok: boolean; message?: string; redirection?: string };

/**
 * Les actions possibles selon l'état, dans l'ordre des boutons de l'onglet « Publication » : un brouillon se publie ou se
 * supprime ; en attente, il peut aussi repartir chez son formateur ; une formation publiée s'archive ou se désactive ;
 * désactivée, elle s'archive ou se réactive ; archivée, elle se republie.
 */
export function actionsFormation({ statut, etat }: { statut: StatutFormation; etat: EtatFormation }): ActionFormation[] {
  const actions: ActionFormation[] = [];
  if (statut === "brouillon") actions.push("publier");
  if (etat === "en_attente") actions.push("renvoyer");
  if (statut === "publiee" || statut === "desactivee") actions.push("archiver");
  if (statut === "publiee") actions.push("desactiver");
  if (statut === "desactivee") actions.push("reactiver");
  if (statut === "archivee") actions.push("republier");
  if (statut === "brouillon") actions.push("supprimer");
  return actions;
}

/** Le libellé de chaque action (bouton de l'onglet « Publication », entrée du menu ⋮). */
export const LIBELLES_ACTIONS: Record<ActionFormation, string> = {
  publier: "Publier",
  renvoyer: "Renvoyer au formateur",
  archiver: "Archiver",
  desactiver: "Désactiver",
  reactiver: "Réactiver",
  republier: "Republier",
  supprimer: "Supprimer le brouillon",
};

/** Publiée au moins une fois : elle ne se supprime plus, elle s'archive (deleteFormation la refuse). */
export function dejaPubliee({ statut, publieeLe }: { statut: StatutFormation; publieeLe?: string | null }): boolean {
  return statut !== "brouillon" || Boolean(publieeLe);
}

type Props = {
  id: string;
  statut: StatutFormation;
  /** Le nombre d'étudiants qui la suivent, pour la fenêtre « Désactiver » ; null s'il n'est pas connu. */
  suiveurs?: number | null;
  fenetre: FenetreFormation;
  onFenetreChange: (fenetre: FenetreFormation) => void;
  /**
   * Après une action réussie, une fois le message affiché. Par défaut, la redirection de l'action est suivie (la fiche
   * d'un brouillon supprimé revient à la liste) ; la liste, elle, se relit sur place.
   */
  apresReussite?: (resultat: Resultat) => void;
  /** L'élément qui reprend le focus à la fermeture (le bouton ⋮ de la carte, le menu ayant disparu). */
  retourFocus?: () => HTMLElement | null;
};

/** Les fenêtres des actions d'une formation ; un refus garde la fenêtre ouverte avec son message (ConfirmDialog). */
export function FenetresFormation({ id, statut, suiveurs = null, fenetre, onFenetreChange, apresReussite, retourFocus }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [erreur, setErreur] = useState<string | undefined>();

  const lancer = (action: () => Promise<Resultat>, succes: string) => async () => {
    const resultat = await action();
    if (!resultat.ok) {
      setErreur(resultat.message);
      throw new Error(resultat.message);
    }
    toast({ tone: "reussite", title: succes });
    if (apresReussite) apresReussite(resultat);
    else if (resultat.redirection) router.push(resultat.redirection);
  };
  const changer = (quoi: Exclude<FenetreFormation, null>) => (ouverte: boolean) => {
    if (!ouverte) setErreur(undefined);
    onFenetreChange(ouverte ? quoi : null);
  };
  const archiver = lancer(() => setStatutFormation(id, "archivee"), "Formation archivée");
  const publier = lancer(() => setStatutFormation(id, "publiee"), "Formation publiée");
  const impossible = {
    open: fenetre === "suppressionImpossible",
    onOpenChange: changer("suppressionImpossible"),
    title: "Cette formation ne peut pas être supprimée",
    description: "Elle a déjà été publiée : ses apprenants gardent leur progression, leurs certificats et leurs avis. Archivez-la pour la retirer du catalogue.",
    icon: InformationCircleIcon,
    iconTone: "information" as const,
    returnFocus: retourFocus,
  };

  return (
    <>
      <ConfirmDialog
        open={fenetre === "publier"}
        onOpenChange={changer("publier")}
        title="Publier cette formation ?"
        description="Elle apparaîtra dans le catalogue. Son adresse ne pourra plus changer."
        confirmLabel="Publier"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={publier}
      />
      <ConfirmDialog
        open={fenetre === "republier"}
        onOpenChange={changer("republier")}
        title="Republier cette formation ?"
        description="Elle revient dans le catalogue et ses leçons se rouvrent."
        confirmLabel="Republier"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={publier}
      />
      <ConfirmDialog
        open={fenetre === "archiver"}
        onOpenChange={changer("archiver")}
        title="Archiver cette formation ?"
        description="Elle disparaît du catalogue et ses leçons se ferment. Rien n’est supprimé : vous pourrez la republier."
        confirmLabel="Archiver"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={archiver}
      />
      <ConfirmDialog
        open={fenetre === "desactiver"}
        onOpenChange={changer("desactiver")}
        tone="danger"
        title="Désactiver cette formation ?"
        description={texteDesactivation(suiveurs)}
        confirmLabel="Désactiver"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={lancer(() => setStatutFormation(id, "desactivee"), "Formation désactivée")}
      />
      <ConfirmDialog
        open={fenetre === "reactiver"}
        onOpenChange={changer("reactiver")}
        title="Réactiver cette formation ?"
        description="Elle revient dans le catalogue et ses leçons se rouvrent. Les étudiants qui la suivent sont prévenus."
        confirmLabel="Réactiver"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={lancer(() => setStatutFormation(id, "publiee"), "Formation réactivée")}
      />
      <ConfirmDialog
        open={fenetre === "supprimer"}
        onOpenChange={changer("supprimer")}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer ce brouillon ?"
        description="Le brouillon, ses modules, ses leçons et leurs fichiers seront supprimés. Cette action est définitive."
        confirmLabel="Supprimer"
        errorMessage={erreur}
        returnFocus={retourFocus}
        onConfirm={lancer(() => deleteFormation(id), "Brouillon supprimé")}
      />
      <FenetreRenvoyerAuFormateur
        id={id}
        ouverte={fenetre === "renvoyer"}
        onOuverteChange={changer("renvoyer")}
        apresReussite={apresReussite && (() => apresReussite({ ok: true }))}
        retourFocus={retourFocus}
      />
      {/* « Supprimer » sur une formation déjà publiée : l'explication, et l'archivage qui la retire du catalogue. */}
      {statut === "archivee" ? (
        <Dialog
          {...impossible}
          footer={
            <DialogClose asChild>
              <Button>Fermer</Button>
            </DialogClose>
          }
        />
      ) : (
        <ConfirmDialog {...impossible} cancelLabel="Fermer" confirmLabel="Archiver" errorMessage={erreur} onConfirm={archiver} />
      )}
    </>
  );
}
