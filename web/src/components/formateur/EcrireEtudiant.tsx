"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BubbleChatIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ouvrirConversation } from "@/lib/messages/actions";

const ECHEC = "La conversation n’a pas pu s’ouvrir. Réessayez.";

/** « Envoyer un message », sur la fiche d'un étudiant : ouvre (ou retrouve) la conversation, dans les messages du formateur. */
export function EcrireEtudiant({ etudiantId }: { etudiantId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [ouverture, setOuverture] = useState(false);

  async function ecrire() {
    if (ouverture) return;
    setOuverture(true);
    const reponse = await ouvrirConversation(etudiantId).catch(() => ({ ok: false as const, message: ECHEC }));
    setOuverture(false);
    if (!reponse.ok) return toast({ tone: "erreur", title: reponse.message });
    router.push(`/formateur/messages?c=${reponse.id}`);
  }

  return (
    <Button variant="contour" iconLeft={BubbleChatIcon} loading={ouverture} onClick={() => void ecrire()}>
      Envoyer un message
    </Button>
  );
}
