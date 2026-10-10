"use client";

import type { ReactNode } from "react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Dialog as RadixDialog } from "radix-ui";
import { cn } from "@/lib/cn";
import { Icon, type IconSvgElement } from "./Icon";

// Pastille d'icône de 48 px aux couleurs de l'état (planche « Modales »).
const ICON_TONES = {
  neutre: "bg-fond-doux text-ardoise-fonce",
  information: "bg-bleu-pale text-bleu",
  reussite: "bg-reussite-fond text-reussite-texte",
  attention: "bg-attention-fond text-attention-texte",
  danger: "bg-erreur-fond text-erreur-texte",
} as const;

export type DialogIconTone = keyof typeof ICON_TONES;

export type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Le titre pose la question (« Se déconnecter ? »). */
  title: ReactNode;
  /** Ce qui va se passer. */
  description?: ReactNode;
  icon?: IconSvgElement;
  iconTone?: DialogIconTone;
  /** Contenu entre le texte et les boutons (champ, illustration, attente…). */
  children?: ReactNode;
  /** Les boutons, alignés à droite. */
  footer?: ReactNode;
  /** Fenêtre bloquante (session expirée) : ni croix, ni Échap, ni clic à côté. */
  dismissible?: boolean;
  /**
   * Élément qui reprend le focus à la fermeture. Par défaut, celui qui avait le focus à l'ouverture ;
   * à préciser quand la fenêtre s'ouvre depuis un menu, qui a disparu entre-temps.
   */
  returnFocus?: () => HTMLElement | null | undefined;
  className?: string;
};

/**
 * Fenêtre de dialogue (planche « Modales et confirmations ») : 420 px, rayon 24, croix en haut à droite.
 * Sous 640 px (NdMobDeconnexion), elle devient une feuille collée en bas : poignée, pas de croix,
 * boutons empilés pleine largeur, l'action au-dessus.
 * Le focus reste dans la fenêtre ; Échap la ferme ; il revient ensuite sur le bouton qui l'a ouverte.
 */
export function Dialog({ open, onOpenChange, title, description, icon, iconTone = "neutre", children, footer, dismissible = true, returnFocus, className }: DialogProps) {
  const block = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        {/* Voile : sur le fond de page #F2F6FD, il donne le gris-bleu #818DA6 de la planche. */}
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[#36476C]/60 motion-safe:animate-fondu max-sm:bg-encre/50" />
        <RadixDialog.Content
          onEscapeKeyDown={block}
          onCloseAutoFocus={(event) => {
            const target = returnFocus?.();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          onPointerDownOutside={block}
          onInteractOutside={block}
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed top-1/2 left-1/2 z-50 box-border max-h-[calc(100dvh-32px)] w-[420px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-bloc bg-panneau p-7 shadow-menu outline-none motion-safe:animate-apparition",
            "max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:w-full max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-panneau max-sm:rounded-b-none max-sm:px-5 max-sm:pt-3 max-sm:pb-[calc(24px+env(safe-area-inset-bottom))]",
            className,
          )}
        >
          <span data-poignee="" aria-hidden="true" className="mx-auto mb-[18px] hidden h-1 w-10 rounded-full bg-sur-encre max-sm:block" />
          {dismissible && (
            <RadixDialog.Close
              aria-label="Fermer"
              className="focus-etudium cible-tactile absolute top-4 right-4 flex size-9 max-sm:hidden cursor-pointer items-center justify-center rounded-puce border-0 bg-transparent p-0 text-discret transition-colors hover:bg-coque"
            >
              <Icon icon={Cancel01Icon} size={18} />
            </RadixDialog.Close>
          )}
          {icon && (
            <span className={cn("mb-[18px] flex size-12 flex-none items-center justify-center rounded-bouton max-sm:mb-3.5", ICON_TONES[iconTone])}>
              <Icon icon={icon} size={22} />
            </span>
          )}
          <RadixDialog.Title className={cn("m-0 text-xl leading-7 font-semibold text-balance text-encre", !icon && dismissible && "pr-9 max-sm:pr-0")}>
            {title}
          </RadixDialog.Title>
          {description && (
            <RadixDialog.Description className="mt-2 mb-0 text-sm leading-[22px] text-pretty text-discret">{description}</RadixDialog.Description>
          )}
          {children && <div className="mt-[18px]">{children}</div>}
          {footer && (
            <div className="mt-6 flex flex-wrap justify-end gap-2 max-sm:mt-5 max-sm:flex-col-reverse max-sm:[&>*]:h-12 max-sm:[&>*]:w-full max-sm:[&>*]:rounded-bouton max-sm:[&>*]:px-[18px] max-sm:[&>*]:text-base">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** Bouton qui ferme la fenêtre (« Annuler », « Plus tard ») : à placer dans `footer`. */
export const DialogClose = RadixDialog.Close;
