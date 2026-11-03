"use client";

import { useState } from "react";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { changerStatutLivre, supprimerLivre } from "@/lib/bibliotheque/actions";
import type { ActionLivre } from "@/lib/bibliotheque/regles";

// Les fenêtres de confirmation des actions sur l'état d'un livre (Bibliothèque, 0074), partagées par le menu ⋮ de sa
// carte et par les boutons de sa fiche : mêmes textes, mêmes messages. Un refus de la base (« Déposez le PDF du livre
// avant de le publier. ») reste affiché dans la fenêtre.

export const LIBELLES_ACTIONS_LIVRE: Record<ActionLivre, string> = {
  publier: "Publier",
  archiver: "Archiver",
  republier: "Republier",
  supprimer: "Supprimer le brouillon",
};

type Resultat = { ok: true; redirection?: string } | { ok: false; message: string };

type Props = {
  id: string;
  fenetre: ActionLivre | null;
  onFenetreChange: (fenetre: ActionLivre | null) => void;
  /** Après une action réussie, une fois le message affiché (la liste se relit, la fiche d'un brouillon supprimé la quitte). */
  apresReussite: (action: ActionLivre, resultat: Resultat) => void;
  /** L'élément qui reprend le focus à la fermeture (le bouton ⋮ de la carte, le menu ayant disparu). */
  retourFocus?: () => HTMLElement | null;
};

export function FenetresLivre({ id, fenetre, onFenetreChange, apresReussite, retourFocus }: Props) {
  const { toast } = useToast();
  const [erreur, setErreur] = useState<string | undefined>();

  const lancer = (action: ActionLivre, faire: () => Promise<Resultat>, succes: string) => async () => {
    let resultat: Resultat;
    try {
      resultat = await faire();
    } catch {
      resultat = { ok: false, message: "L’action n’a pas abouti. Vérifiez votre connexion, puis réessayez." };
    }
    if (!resultat.ok) {
      setErreur(resultat.message);
      throw new Error(resultat.message);
    }
    toast({ tone: "reussite", title: succes });
    apresReussite(action, resultat);
  };
  const changer = (quoi: ActionLivre) => (ouverte: boolean) => {
    if (!ouverte) setErreur(undefined);
    onFenetreChange(ouverte ? quoi : null);
  };
  const commun = { errorMessage: erreur, returnFocus: retourFocus };

  return (
    <>
      <ConfirmDialog
        {...commun}
        open={fenetre === "publier"}
        onOpenChange={changer("publier")}
        title="Publier ce livre ?"
        description="Il apparaîtra dans la Bibliothèque des étudiants qui y ont accès. Son adresse ne pourra plus changer."
        confirmLabel="Publier"
        onConfirm={lancer("publier", () => changerStatutLivre(id, "publie"), "Livre publié")}
      />
      <ConfirmDialog
        {...commun}
        open={fenetre === "archiver"}
        onOpenChange={changer("archiver")}
        title="Archiver ce livre ?"
        description="Il disparaît de la Bibliothèque et ne se lit plus. Rien n’est supprimé : vous pourrez le republier."
        confirmLabel="Archiver"
        onConfirm={lancer("archiver", () => changerStatutLivre(id, "archive"), "Livre archivé")}
      />
      <ConfirmDialog
        {...commun}
        open={fenetre === "republier"}
        onOpenChange={changer("republier")}
        title="Republier ce livre ?"
        description="Il revient dans la Bibliothèque, et ses lecteurs le retrouvent là où ils l’avaient laissé."
        confirmLabel="Republier"
        onConfirm={lancer("republier", () => changerStatutLivre(id, "publie"), "Livre republié")}
      />
      <ConfirmDialog
        {...commun}
        open={fenetre === "supprimer"}
        onOpenChange={changer("supprimer")}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer ce brouillon ?"
        description="Le livre, son PDF et sa couverture seront supprimés. Cette action est définitive."
        confirmLabel="Supprimer"
        onConfirm={lancer("supprimer", () => supprimerLivre(id), "Brouillon supprimé")}
      />
    </>
  );
}
