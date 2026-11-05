"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { Retour } from "@/lib/resultats/actions";

const ECHEC = "L’enregistrement n’a pas abouti. Vérifie ta connexion, puis réessaie.";

type FenetreSaisieProps = {
  titre: string;
  description?: string;
  bouton: string;
  onFermer: () => void;
  /** Vérifie puis envoie : un refus local se rend comme un refus de la base. */
  envoyer: () => Retour | Promise<Retour>;
  onFait?: (retour: Retour & { ok: true }) => void;
  children: ReactNode;
};

/** Une fenêtre de saisie : le formulaire, le refus éventuel au-dessus des boutons, « Annuler » et l'action. */
export function FenetreSaisie({ titre, description, bouton, onFermer, envoyer, onFait, children }: FenetreSaisieProps) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const soumettre = async (event: FormEvent) => {
    event.preventDefault();
    if (envoi) return;
    setMessage(null);
    setEnvoi(true);
    let retour: Retour;
    try {
      retour = await envoyer();
    } catch {
      retour = { ok: false, message: ECHEC };
    }
    setEnvoi(false);
    if (retour.ok) {
      onFait?.(retour);
      onFermer();
      return;
    }
    setMessage(retour.message);
    // Reverrouillé entre-temps : la page montre le clavier.
    if (retour.verrouille) router.refresh();
  };

  return (
    <Dialog open onOpenChange={(ouvert) => !ouvert && !envoi && onFermer()} title={titre} description={description}>
      <form noValidate onSubmit={soumettre} className="flex flex-col gap-4">
        {children}
        {message && <Banner tone="erreur" title={message} />}
        <div className="mt-2 flex flex-wrap justify-end gap-2 max-sm:flex-col-reverse max-sm:[&>*]:w-full">
          <Button variant="contour" onClick={onFermer} disabled={envoi}>
            Annuler
          </Button>
          <Button type="submit" loading={envoi}>
            {bouton}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
