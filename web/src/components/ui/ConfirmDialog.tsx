"use client";

import { useState, type ReactNode } from "react";
import type { IconSvgElement } from "./Icon";
import { Banner } from "./Banner";
import { Button } from "./Button";
import { Dialog, DialogClose, type DialogIconTone } from "./Dialog";

export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** La question (« Supprimer cette publication ? »). */
  title: ReactNode;
  /** Ce qui va se passer. */
  description: ReactNode;
  /** Le verbe de l'action (« Supprimer », « Se déconnecter »). */
  confirmLabel: string;
  cancelLabel?: string;
  /** « danger » : bouton rouge, pour une action irréversible. */
  tone?: "neutre" | "danger";
  /**
   * Si l'action renvoie une promesse, le bouton reste en chargement jusqu'à la fin, puis la fenêtre se ferme.
   * Si la promesse échoue, la fenêtre reste ouverte et affiche `errorMessage` : on peut réessayer.
   */
  onConfirm: () => void | Promise<void>;
  /** Message affiché si l'action échoue. */
  errorMessage?: string;
  icon?: IconSvgElement;
  iconTone?: DialogIconTone;
  /** Bouton de confirmation désactivé (mot de confirmation pas encore saisi…). */
  confirmDisabled?: boolean;
  /** Voir `Dialog` : élément qui reprend le focus à la fermeture. */
  returnFocus?: () => HTMLElement | null | undefined;
  children?: ReactNode;
};

/** Confirmation d'une action : le titre pose la question, le bouton reprend le verbe de l'action. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Annuler",
  tone = "neutre",
  onConfirm,
  icon,
  iconTone,
  confirmDisabled = false,
  returnFocus,
  errorMessage = "L’action n’a pas abouti. Vérifiez votre connexion, puis réessayez.",
  children,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    const result = onConfirm();
    if (!(result instanceof Promise)) {
      onOpenChange(false);
      return;
    }
    setPending(true);
    setFailed(false);
    try {
      await result;
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        if (!next) setFailed(false);
        onOpenChange(next);
      }}
      title={title}
      description={description}
      returnFocus={returnFocus}
      icon={icon}
      iconTone={iconTone ?? (tone === "danger" ? "danger" : "neutre")}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="contour" disabled={pending}>
              {cancelLabel}
            </Button>
          </DialogClose>
          <Button variant={tone === "danger" ? "danger" : "principal"} loading={pending} disabled={confirmDisabled} onClick={confirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(children || failed) && (
        <div className="flex flex-col gap-3.5">
          {children}
          {failed && <Banner tone="erreur">{errorMessage}</Banner>}
        </div>
      )}
    </Dialog>
  );
}
