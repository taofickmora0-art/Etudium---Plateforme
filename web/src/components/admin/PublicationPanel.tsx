"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteFormation, setStatutFormation } from "@/lib/admin/actions";
import type { StatutFormation } from "@/lib/contenus/libelles";

type Resultat = { ok: boolean; message?: string; redirection?: string };
type Confirmation = "publier" | "archiver" | "supprimer" | null;

const EXPLICATION: Record<StatutFormation, string> = {
  brouillon: "Brouillon : visible seulement par l’équipe.",
  publiee: "Publiée : visible dans le catalogue.",
  archivee: "Archivée : retirée du catalogue. Rien n’est supprimé.",
};

/** Onglet « Publication » : publier, archiver, republier, ou supprimer un brouillon (spec du lot 1, §10). */
export function PublicationPanel({ id, statut }: { id: string; statut: StatutFormation }) {
  const router = useRouter();
  const { toast } = useToast();
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [erreur, setErreur] = useState<string | undefined>();

  /** Lance l'action ; un refus garde la fenêtre ouverte avec son message (ConfirmDialog). */
  const lancer = (action: () => Promise<Resultat>, succes: string) => async () => {
    const resultat = await action();
    if (!resultat.ok) {
      setErreur(resultat.message);
      throw new Error(resultat.message);
    }
    toast({ tone: "reussite", title: succes });
    if (resultat.redirection) router.push(resultat.redirection);
  };
  const ouvrir = (quoi: Confirmation) => {
    setErreur(undefined);
    setConfirmation(quoi);
  };
  const fermer = (ouvert: boolean) => !ouvert && setConfirmation(null);

  return (
    <div className="flex max-w-[680px] flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6">
      <p className="m-0 text-[15px] leading-6 text-texte">{EXPLICATION[statut]}</p>
      <div className="flex flex-wrap gap-2">
        {statut === "brouillon" && <Button onClick={() => ouvrir("publier")}>Publier</Button>}
        {statut === "publiee" && (
          <Button variant="contour" onClick={() => ouvrir("archiver")}>
            Archiver
          </Button>
        )}
        {statut === "archivee" && <Button onClick={() => ouvrir("publier")}>Republier</Button>}
        {statut === "brouillon" && (
          <Button variant="dangerDoux" onClick={() => ouvrir("supprimer")}>
            Supprimer le brouillon
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmation === "publier"}
        onOpenChange={fermer}
        title={statut === "archivee" ? "Republier cette formation ?" : "Publier cette formation ?"}
        description={
          statut === "archivee" ? "Elle revient dans le catalogue et ses leçons se rouvrent." : "Elle apparaîtra dans le catalogue. Son adresse ne pourra plus changer."
        }
        confirmLabel={statut === "archivee" ? "Republier" : "Publier"}
        errorMessage={erreur}
        onConfirm={lancer(() => setStatutFormation(id, "publiee"), "Formation publiée")}
      />
      <ConfirmDialog
        open={confirmation === "archiver"}
        onOpenChange={fermer}
        title="Archiver cette formation ?"
        description="Elle disparaît du catalogue et ses leçons se ferment. Rien n’est supprimé : vous pourrez la republier."
        confirmLabel="Archiver"
        errorMessage={erreur}
        onConfirm={lancer(() => setStatutFormation(id, "archivee"), "Formation archivée")}
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
        onConfirm={lancer(() => deleteFormation(id), "Brouillon supprimé")}
      />
    </div>
  );
}
