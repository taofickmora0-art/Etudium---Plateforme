"use client";

import { useRouter } from "next/navigation";
import { useToastFacultatif } from "@/components/ui/Toast";
import { deplacerElement, type Retour, type TypeElement } from "@/lib/resultats/actions";

/** Monter ou descendre un semestre, une UE ou une ECUE ; un refus s'affiche (reverrouillé : la page montre le clavier). */
export function useDeplacer() {
  const router = useRouter();
  const toast = useToastFacultatif();
  return async (type: Exclude<TypeElement, "note">, id: string, sens: -1 | 1) => {
    let retour: Retour;
    try {
      retour = await deplacerElement(type, id, sens);
    } catch {
      retour = { ok: false, message: "Le déplacement n’a pas abouti." };
    }
    if (retour.ok) return;
    toast?.({ tone: "erreur", title: retour.message });
    if (retour.verrouille) router.refresh();
  };
}
