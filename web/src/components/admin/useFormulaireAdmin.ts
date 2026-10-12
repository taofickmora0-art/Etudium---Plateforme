"use client";

import { startTransition, useActionState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { authErrorMessage } from "@/lib/auth/messages";
import { IDLE, type FormState } from "@/lib/auth/schemas";

type Options = {
  /** Notification après un succès. */
  succes?: string;
  /** Vider le formulaire après un succès (« Ajouter un module », « Ajouter la leçon »). */
  viderApresSucces?: boolean;
};

/**
 * Branche un formulaire du back-office sur son action serveur (motif du profil) : notification de succès, saisie
 * gardée en cas d'erreur, coupure réseau annoncée au lieu de l'écran d'erreur. Après une création, l'action rend
 * `redirection` et c'est le navigateur qui s'y rend.
 *
 * L'envoi passe par `onSubmit` (et non `<form action>`) : React remettrait sinon le formulaire à zéro après chaque
 * action, et interrupteurs et listes déroulantes reviendraient à leur valeur du premier affichage — l'enregistrement
 * suivant écraserait alors en silence ce qui vient d'être enregistré.
 */
export function useFormulaireAdmin(action: (prev: FormState, fd: FormData) => Promise<FormState>, options: Options = {}) {
  const { succes = "Modifications enregistrées", viderApresSucces = false } = options;
  const { toast } = useToast();
  const router = useRouter();
  const formulaire = useRef<HTMLFormElement | null>(null);
  const [state, dispatch, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    try {
      const resultat = await action(prev, fd);
      if (resultat.status === "success") {
        toast({ tone: "reussite", title: succes });
        if (viderApresSucces) formulaire.current?.reset();
        if (resultat.redirection) router.push(resultat.redirection);
      }
      return resultat;
    } catch {
      const values: Record<string, string> = {};
      // Plusieurs valeurs pour un même nom (parcours cochés) : on les garde toutes.
      for (const [cle, valeur] of fd.entries()) values[cle] = cle in values ? `${values[cle]},${valeur}` : String(valeur);
      return { status: "error", message: authErrorMessage(null), values };
    }
  }, IDLE);

  const envoyer = (evenement: FormEvent<HTMLFormElement>) => {
    evenement.preventDefault();
    formulaire.current = evenement.currentTarget;
    const donnees = new FormData(evenement.currentTarget);
    startTransition(() => dispatch(donnees));
  };
  const erreurs = state.fieldErrors ?? {};
  /** Après un envoi, la saisie (même en cas d'erreur) ; sinon, la valeur enregistrée. */
  const valeur = (champ: string, enregistre: string | null | undefined) => state.values?.[champ] ?? enregistre ?? "";
  return { state, envoyer, pending, erreurs, valeur };
}
