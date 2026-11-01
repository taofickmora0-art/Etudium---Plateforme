"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Delete02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { deleteFormation, setStatutFormation } from "@/lib/admin/actions";
import type { FormationAdmin } from "@/lib/admin/types";
import type { StatutFormation } from "@/lib/contenus/libelles";
import { dateCourte } from "@/lib/utilisateurs/regles";
import { ModificationsNonPubliees } from "@/components/editeur/ModificationsNonPubliees";
import { RenvoyerAuFormateur } from "./RenvoyerAuFormateur";

type Resultat = { ok: boolean; message?: string; redirection?: string };
type Confirmation = "publier" | "archiver" | "supprimer" | null;

const EXPLICATION: Record<StatutFormation, string> = {
  brouillon: "Brouillon : visible seulement par l’équipe et par son formateur.",
  publiee: "Publiée : visible dans le catalogue.",
  archivee: "Archivée : retirée du catalogue. Rien n’est supprimé.",
};

type Props = {
  id: string;
  formation: Pick<FormationAdmin, "statut" | "etat" | "envoyeeLe" | "renvoyeeLe" | "remarqueRelecture" | "modifieeParFormateurLe" | "publieeLe" | "modificationsNonPubliees">;
  /** Nom de la fiche formateur de la formation, ou null. */
  formateurNom: string | null;
  /** La version en ligne (0057) : « Version 8 · aujourd’hui » ; null sans historique. */
  version?: string | null;
};

/** Ce que l'équipe doit savoir de la relecture (spec de l'espace formateur, §4). */
function EtatRelecture({ formation, formateurNom }: Omit<Props, "id" | "version">) {
  if (formation.etat === "en_attente" && formation.envoyeeLe) {
    return (
      <p className="m-0 text-[15px] leading-6 font-medium text-encre">
        {`Envoyée en relecture le ${dateCourte(formation.envoyeeLe)}${formateurNom ? ` par ${formateurNom}` : ""}`}
      </p>
    );
  }
  if (formation.etat === "a_corriger" && formation.renvoyeeLe) {
    return (
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[15px] leading-6 font-medium text-encre">{`Renvoyée au formateur le ${dateCourte(formation.renvoyeeLe)}`}</p>
        {formation.remarqueRelecture && <p className="m-0 text-sm leading-[22px] break-words whitespace-pre-line text-discret">{formation.remarqueRelecture}</p>}
      </div>
    );
  }
  if (formation.statut === "publiee" && formation.modifieeParFormateurLe) {
    return <p className="m-0 text-sm leading-[22px] text-discret">{`Modifiée par le formateur le ${dateCourte(formation.modifieeParFormateurLe)}`}</p>;
  }
  return null;
}

/** Onglet « Publication » : publier, archiver, republier, renvoyer au formateur, ou supprimer un brouillon (spec du lot 1, §10). */
export function PublicationPanel({ id, formation, formateurNom, version = null }: Props) {
  const { statut } = formation;
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
      {formation.modificationsNonPubliees && <ModificationsNonPubliees formationId={id} />}
      <EtatRelecture formation={formation} formateurNom={formateurNom} />
      <p className="m-0 text-[15px] leading-6 text-texte">{EXPLICATION[statut]}</p>
      {version && <p className="m-0 text-sm leading-[22px] text-discret">{version}</p>}
      <div className="flex flex-wrap gap-2">
        {statut === "brouillon" && <Button onClick={() => ouvrir("publier")}>Publier</Button>}
        {formation.etat === "en_attente" && <RenvoyerAuFormateur id={id} />}
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
