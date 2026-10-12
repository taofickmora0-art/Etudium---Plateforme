"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CourseIcon, Delete02Icon, PlayCircleIcon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { List, ListRow } from "@/components/ui/ListRow";
import { Heading } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { addLecon, addModule, deleteLecon, deleteModule, renameModule } from "@/lib/admin/actions";
import { formatDuree } from "@/lib/admin/duree";
import type { FormationAdmin, LeconResume, ModuleAdmin } from "@/lib/admin/types";
import { BoutonsOrdre } from "./BoutonsOrdre";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

type Resultat = { ok: boolean; message?: string };

/** « 06:10 · Aperçu · Sans vidéo » : ce qu'il reste à compléter se voit d'un coup d'œil. */
const resumeLecon = (l: LeconResume) =>
  [formatDuree(l.dureeSecondes) || "Durée à saisir", l.apercu && "Aperçu", l.aVideo ? "Vidéo" : "Sans vidéo"].filter(Boolean).join(" · ");

/** « Ses 2 leçons… », « Sa leçon… », « Ce module est vide. » */
const consequenceSuppression = (n: number) =>
  n === 0
    ? "Ce module est vide."
    : n === 1
      ? "Sa leçon, sa vidéo et ses ressources seront supprimées."
      : `Ses ${n} leçons, leurs vidéos et leurs ressources seront supprimées.`;

/** Suppression confirmée : un refus garde la fenêtre ouverte avec son message. */
function useSuppression() {
  const { toast } = useToast();
  const [erreur, setErreur] = useState<string | undefined>();
  const supprimer = (action: () => Promise<Resultat>, succes: string) => async () => {
    const resultat = await action();
    if (!resultat.ok) {
      setErreur(resultat.message);
      throw new Error(resultat.message);
    }
    toast({ tone: "reussite", title: succes });
  };
  return { erreur, reinitialiser: () => setErreur(undefined), supprimer };
}

function FormulaireTitre({
  action,
  champs,
  label,
  bouton,
  valeurInitiale = "",
  succes,
}: {
  action: Parameters<typeof useFormulaireAdmin>[0];
  champs: Record<string, string>;
  label: string;
  bouton: string;
  valeurInitiale?: string;
  succes: string;
}) {
  const id = useId();
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(action, succes);
  return (
    <form action={envoyer} noValidate className="flex flex-col gap-2">
      {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
      {Object.entries(champs).map(([nom, v]) => (
        <input key={nom} type="hidden" name={nom} value={v} />
      ))}
      <div className="flex flex-wrap items-end gap-2">
        <Field label={label} htmlFor={id} error={e.titre} className="min-w-0 flex-1 basis-[220px]">
          <TextInput id={id} name="titre" defaultValue={valeur("titre", valeurInitiale)} maxLength={120} />
        </Field>
        <Button type="submit" variant="contour" loading={pending}>
          {bouton}
        </Button>
      </div>
    </form>
  );
}

function ModuleBloc({ formationId, module, rang, premier, dernier }: { formationId: string; module: ModuleAdmin; rang: number; premier: boolean; dernier: boolean }) {
  const titreId = useId();
  const [confirmation, setConfirmation] = useState<"module" | LeconResume | null>(null);
  const { erreur, reinitialiser, supprimer } = useSuppression();
  const ouvrir = (quoi: "module" | LeconResume) => {
    reinitialiser();
    setConfirmation(quoi);
  };
  const lecon = confirmation && confirmation !== "module" ? confirmation : null;

  return (
    <section aria-labelledby={titreId} className="flex flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-5">
      <div className="flex items-center justify-between gap-3">
        <Heading level="card" as="h3">
          <span id={titreId}>Module {rang}</span>
        </Heading>
        <span className="flex flex-none items-center gap-1">
          <BoutonsOrdre table="modules" id={module.id} nom={module.titre} premier={premier} dernier={dernier} />
          <IconButton icon={Delete02Icon} label={`Supprimer le module « ${module.titre} »`} variant="discret" size="sm" onClick={() => ouvrir("module")} />
        </span>
      </div>
      <FormulaireTitre action={renameModule} champs={{ id: module.id }} label="Titre du module" bouton="Renommer" valeurInitiale={module.titre} succes="Module renommé" />

      {module.lecons.length === 0 ? (
        <p className="m-0 text-[13px] leading-5 text-discret">Aucune leçon dans ce module.</p>
      ) : (
        <List label={`Leçons du module ${rang}`}>
          {module.lecons.map((l, index) => (
            <ListRow
              key={l.id}
              leading={<IconTile icon={PlayCircleIcon} />}
              title={
                <Link href={`/admin/formations/${formationId}/lecons/${l.id}`} className="focus-etudium text-inherit no-underline hover:underline">
                  {l.titre}
                </Link>
              }
              subtitle={resumeLecon(l)}
              trailing={
                <span className="flex flex-none items-center gap-1">
                  <BoutonsOrdre table="lecons" id={l.id} nom={l.titre} premier={index === 0} dernier={index === module.lecons.length - 1} />
                  <IconButton icon={Delete02Icon} label={`Supprimer la leçon « ${l.titre} »`} variant="discret" size="sm" onClick={() => ouvrir(l)} />
                </span>
              }
            />
          ))}
        </List>
      )}
      <FormulaireTitre action={addLecon} champs={{ module_id: module.id }} label="Nouvelle leçon" bouton="Ajouter la leçon" succes="Leçon créée" />

      <ConfirmDialog
        open={confirmation === "module"}
        onOpenChange={(ouvert) => !ouvert && setConfirmation(null)}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer ce module ?"
        description={consequenceSuppression(module.lecons.length)}
        confirmLabel="Supprimer"
        errorMessage={erreur}
        onConfirm={supprimer(() => deleteModule(module.id), "Module supprimé")}
      />
      <ConfirmDialog
        open={lecon !== null}
        onOpenChange={(ouvert) => !ouvert && setConfirmation(null)}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer cette leçon ?"
        description={`« ${lecon?.titre ?? ""} » : sa vidéo, son texte et ses ressources seront supprimés.`}
        confirmLabel="Supprimer"
        errorMessage={erreur}
        onConfirm={supprimer(() => (lecon ? deleteLecon(lecon.id) : Promise.resolve({ ok: true })), "Leçon supprimée")}
      />
    </section>
  );
}

/** Onglet « Programme » : modules et leçons, dans l'ordre, avec ajout, renommage, ordre et suppression. */
export function ProgrammeEditor({ formation }: { formation: Pick<FormationAdmin, "id" | "modules"> }) {
  const { modules } = formation;
  return (
    <div className="flex max-w-[680px] flex-col gap-4">
      {modules.length === 0 ? (
        <EmptyState icon={CourseIcon} title="Aucun module pour le moment" description="Commencez par ajouter un module, puis ses leçons." />
      ) : (
        modules.map((m, index) => (
          <ModuleBloc key={m.id} formationId={formation.id} module={m} rang={index + 1} premier={index === 0} dernier={index === modules.length - 1} />
        ))
      )}
      <div className="rounded-carte border border-dashed border-bordure-carte bg-panneau p-5">
        <FormulaireTitre action={addModule} champs={{ formation_id: formation.id }} label="Nouveau module" bouton="Ajouter le module" succes="Module ajouté" />
      </div>
    </div>
  );
}
