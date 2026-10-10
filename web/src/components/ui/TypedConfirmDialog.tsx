"use client";

import { useId, useState } from "react";
import { ConfirmDialog, type ConfirmDialogProps } from "./ConfirmDialog";
import { Field } from "./Field";
import { TextInput } from "./TextInput";

type TypedConfirmDialogProps = Omit<ConfirmDialogProps, "confirmDisabled" | "children"> & {
  /** Mot à recopier exactement, majuscules comprises (« SUPPRIMER »). */
  confirmWord: string;
};

/** Confirmation renforcée d'une action définitive : le bouton reste inactif tant que le mot n'est pas recopié. */
export function TypedConfirmDialog({ confirmWord, onOpenChange, ...props }: TypedConfirmDialogProps) {
  const id = useId();
  const [typed, setTyped] = useState("");
  return (
    <ConfirmDialog
      {...props}
      onOpenChange={(open) => {
        if (!open) setTyped("");
        onOpenChange(open);
      }}
      // Les claviers de téléphone ajoutent souvent une espace après le mot : on l'ignore, mais pas les majuscules.
      confirmDisabled={typed.trim() !== confirmWord}
    >
      <Field label={`Pour confirmer, saisissez ${confirmWord}`} htmlFor={id}>
        <TextInput
          id={id}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={confirmWord}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
        />
      </Field>
    </ConfirmDialog>
  );
}
