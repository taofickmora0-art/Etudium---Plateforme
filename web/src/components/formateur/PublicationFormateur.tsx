"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteFormation, envoyerEnRelecture } from "@/lib/admin/actions";
import type { FormationAdmin } from "@/lib/admin/types";
import { dateCourte } from "@/lib/utilisateurs/regles";

type Resultat = { ok: boolean; message?: string; redirection?: string };
type Props = {
  id: string;
  formation: Pick<FormationAdmin, "etat" | "envoyeeLe" | "renvoyeeLe" | "remarqueRelecture" | "publieeLe">;
};

const TEXTE = "m-0 text-[15px] leading-6 text-texte";

/**
 * Onglet « Publication » du formateur (spec de l'espace formateur, §3) : il envoie son brouillon en relecture, voit la
 * remarque de l'admin s'il est renvoyé, et supprime un brouillon jamais publié. Publier et archiver reviennent à l'équipe.
 */
export function PublicationFormateur({ id, formation }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState<"envoyer" | "supprimer" | null>(null);
  const [erreur, setErreur] = useState<string | undefined>();
  const { etat } = formation;

  const lancer = (action: () => Promise<Resultat>, succes: string) => async () => {
    const resultat = await action();
    if (!resultat.ok) {
      setErreur(resultat.message);
      throw new Error(resultat.message);
    }
    toast({ tone: "reussite", title: succes });
    if (resultat.redirection) router.push(resultat.redirection);
  };
  const ouvrir = (quoi: "envoyer" | "supprimer") => {
    setErreur(undefined);
    setConfirmation(quoi);
  };
  const fermer = (ouvert: boolean) => !ouvert && setConfirmation(null);
  const peutEnvoyer = etat === "brouillon" || etat === "a_corriger";

  return (
    <div className="flex max-w-[680px] min-w-0 flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6">
      {etat === "brouillon" && <p className={TEXTE}>Brouillon : visible seulement par vous et l’équipe Étudium. Envoyez-le en relecture quand il est prêt.</p>}
      {etat === "en_attente" && formation.envoyeeLe && (
        <p className={TEXTE}>{`Envoyée en relecture le ${dateCourte(formation.envoyeeLe)}. Un admin la relit ; vous pouvez continuer à la modifier.`}</p>
      )}
      {etat === "a_corriger" && (
        <Banner tone="attention" title={formation.renvoyeeLe ? `À corriger · Renvoyée le ${dateCourte(formation.renvoyeeLe)}` : "À corriger"}>
          <span className="break-words whitespace-pre-line">{formation.remarqueRelecture}</span>
        </Banner>
      )}
      {etat === "publiee" && formation.publieeLe && (
        <p className={TEXTE}>{`En ligne depuis le ${dateCourte(formation.publieeLe)}. Vos corrections sont visibles tout de suite.`}</p>
      )}
      {etat === "archivee" && <p className={TEXTE}>Archivée par l’équipe Étudium.</p>}

      {peutEnvoyer && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => ouvrir("envoyer")}>Envoyer en relecture</Button>
          {etat === "brouillon" && formation.publieeLe === null && (
            <Button variant="dangerDoux" onClick={() => ouvrir("supprimer")}>
              Supprimer le brouillon
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmation === "envoyer"}
        onOpenChange={fermer}
        title="Envoyer en relecture ?"
        description="Un admin la relit avant de la mettre en ligne. Vous pourrez continuer à la modifier pendant ce temps."
        confirmLabel="Envoyer"
        errorMessage={erreur}
        onConfirm={lancer(() => envoyerEnRelecture(id), "Formation envoyée en relecture")}
      />
      <ConfirmDialog
        open={confirmation === "supprimer"}
        onOpenChange={fermer}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer ce brouillon ?"
        description="Le brouillon, ses modules, ses leçons et leurs fichiers seront supprimés. Cette action est définitive."
        confirmLabel="Supprimer"
        errorMessage={erreur}
        onConfirm={lancer(() => deleteFormation(id, "formateur"), "Brouillon supprimé")}
      />
    </div>
  );
}
