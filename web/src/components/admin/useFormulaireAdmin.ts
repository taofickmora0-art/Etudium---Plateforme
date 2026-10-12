"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { authErrorMessage } from "@/lib/auth/messages";
import { IDLE, type FormState } from "@/lib/auth/schemas";

/**
 * Branche un formulaire du back-office sur son action serveur (motif du profil) : notification de succès, saisie
 * gardée en cas d'erreur, coupure réseau annoncée au lieu de l'écran d'erreur. Après une création, l'action rend
 * `redirection` et c'est le navigateur qui s'y rend.
 */
export function useFormulaireAdmin(action: (prev: FormState, fd: FormData) => Promise<FormState>, succes = "Modifications enregistrées") {
  const { toast } = useToast();
  const router = useRouter();
  const [state, envoyer, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    try {
      const resultat = await action(prev, fd);
      if (resultat.status === "success") {
        toast({ tone: "reussite", title: succes });
        if (resultat.redirection) router.push(resultat.redirection);
      }
      return resultat;
    } catch {
      const values = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
      return { status: "error", message: authErrorMessage(null), values };
    }
  }, IDLE);
  const erreurs = state.fieldErrors ?? {};
  /** Après un envoi, la saisie (même en cas d'erreur) ; sinon, la valeur enregistrée. */
  const valeur = (champ: string, enregistre: string | null | undefined) => state.values?.[champ] ?? enregistre ?? "";
  return { state, envoyer, pending, erreurs, valeur };
}
