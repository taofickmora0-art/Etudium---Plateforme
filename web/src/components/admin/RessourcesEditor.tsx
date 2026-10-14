"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { Delete02Icon, File02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { FileDrop } from "@/components/ui/FileDrop";
import { FileRow } from "@/components/ui/FileRow";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Switch } from "@/components/ui/Switch";
import { Heading } from "@/components/ui/Text";
import { TextInput } from "@/components/ui/TextInput";
import { useToast } from "@/components/ui/Toast";
import { addRessource, deleteRessource, updateRessource } from "@/lib/admin/actions";
import { FORMATS, formatDe, formatParMime, RESSOURCE_MAX_OCTETS, tailleLisible } from "@/lib/admin/fichiers";
import type { LeconAdmin, RessourceAdmin } from "@/lib/admin/types";
import { createClient } from "@/lib/supabase/client";
import { BoutonsOrdre } from "./BoutonsOrdre";
import { identifiantAleatoire } from "@/lib/identifiant";

const FORMAT_REFUSE = "Format non accepté : PDF, images, Excel, Word, PowerPoint, ZIP, CSV ou texte.";
const ACCEPT = FORMATS.flatMap((f) => f.extensions.map((e) => `.${e}`)).join(",");

/** « PDF · 1,2 Mo · Consultation seule » */
const meta = (r: RessourceAdmin) =>
  [formatParMime(r.format)?.label ?? "Fichier", tailleLisible(r.tailleOctets), r.telechargeable ? "Téléchargeable" : "Consultation seule"].join(" · ");

const sansExtension = (nom: string) => (nom.lastIndexOf(".") > 0 ? nom.slice(0, nom.lastIndexOf(".")) : nom).slice(0, 120);

type Resultat = { ok: boolean; message?: string };

function LigneRessource({ ressource, premier, dernier }: { ressource: RessourceAdmin; premier: boolean; dernier: boolean }) {
  const id = useId();
  const { toast } = useToast();
  const [enCours, demarrer] = useTransition();
  const [titre, setTitre] = useState(ressource.titre);
  const [suppression, setSuppression] = useState(false);
  const [erreur, setErreur] = useState<string | undefined>();
  const consultable = formatParMime(ressource.format)?.consultable === true;

  const modifier = (changement: { titre?: string; telechargeable?: boolean }, succes: string) =>
    demarrer(async () => {
      let resultat: Resultat;
      try {
        resultat = await updateRessource({ id: ressource.id, titre: changement.titre ?? ressource.titre, telechargeable: changement.telechargeable ?? ressource.telechargeable });
      } catch {
        resultat = { ok: false };
      }
      toast(resultat.ok ? { tone: "reussite", title: succes } : { tone: "erreur", title: resultat.message ?? "La modification n’a pas abouti." });
    });
  const renommer = (evenement: FormEvent) => {
    evenement.preventDefault();
    modifier({ titre }, "Titre enregistré");
  };

  return (
    <li className="flex flex-col gap-3 rounded-bouton border border-bordure-carte p-3.5">
      {/* Sur un petit écran, les boutons passent sous le titre plutôt que de l'écraser. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <IconTile icon={File02Icon} />
        <span className="flex min-w-[150px] flex-1 flex-col">
          <span title={ressource.titre} className="truncate text-sm leading-5 font-medium text-encre">
            {ressource.titre}
          </span>
          <span className="text-xs leading-[18px] text-discret">{meta(ressource)}</span>
        </span>
        <span role="group" aria-label={`Actions de « ${ressource.titre} »`} className="ml-auto flex flex-none items-center gap-1">
          <BoutonsOrdre table="ressources" id={ressource.id} nom={ressource.titre} premier={premier} dernier={dernier} />
          <IconButton
            icon={Delete02Icon}
            label={`Supprimer « ${ressource.titre} »`}
            variant="discret"
            size="sm"
            onClick={() => {
              setErreur(undefined);
              setSuppression(true);
            }}
          />
        </span>
      </div>
      <form onSubmit={renommer} className="flex flex-wrap items-end gap-2">
        <Field label="Titre du fichier" htmlFor={id} className="min-w-0 flex-1 basis-[200px]">
          <TextInput id={id} value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={120} />
        </Field>
        <Button type="submit" variant="contour" loading={enCours} disabled={titre.trim() === ressource.titre}>
          Renommer
        </Button>
      </form>
      {consultable && (
        <Switch
          label="Consultation seule"
          description="Affiché dans le visualiseur intégré, sans bouton de téléchargement."
          checked={!ressource.telechargeable}
          disabled={enCours}
          onCheckedChange={(seule) => modifier({ telechargeable: !seule }, seule ? "Passé en consultation seule" : "Fichier téléchargeable")}
        />
      )}
      <ConfirmDialog
        open={suppression}
        onOpenChange={setSuppression}
        tone="danger"
        icon={Delete02Icon}
        iconTone="danger"
        title="Supprimer ce fichier ?"
        description={`« ${ressource.titre} » sera retiré de la leçon et supprimé.`}
        confirmLabel="Supprimer"
        errorMessage={erreur}
        onConfirm={async () => {
          const resultat = await deleteRessource(ressource.id);
          if (!resultat.ok) {
            setErreur(resultat.message);
            throw new Error(resultat.message);
          }
          toast({ tone: "reussite", title: "Fichier supprimé" });
        }}
      />
    </li>
  );
}

/** Ressources d'une leçon (spec du lot 1, §6) : envoi direct vers l'espace « ressources », puis enregistrement. */
export function RessourcesEditor({ lecon }: { lecon: Pick<LeconAdmin, "id" | "formationId" | "ressources"> }) {
  const { toast } = useToast();
  const [envois, setEnvois] = useState<{ cle: string; nom: string; taille: number }[]>([]);

  const envoyer = async (fichier: File) => {
    if (fichier.size > RESSOURCE_MAX_OCTETS) {
      toast({ tone: "erreur", title: `« ${fichier.name} » : ce fichier dépasse 50 Mo.` });
      return;
    }
    const octets = new Uint8Array(await fichier.slice(0, 16).arrayBuffer());
    const format = formatDe(fichier.name, octets);
    const extension = format ? formatParMime(format)?.extensions[0] : undefined;
    if (!format || !extension) {
      toast({ tone: "erreur", title: `« ${fichier.name} » : ${FORMAT_REFUSE}` });
      return;
    }
    const cle = identifiantAleatoire();
    const chemin = `${lecon.formationId}/${cle}.${extension}`;
    setEnvois((liste) => [...liste, { cle, nom: fichier.name, taille: fichier.size }]);
    try {
      const stockage = createClient().storage.from("ressources");
      // Avec un fichier, Supabase envoie le type annoncé par le navigateur (Windows : « application/x-zip-compressed »,
      // ou rien du tout pour un fichier Office sans Office) au lieu de `contentType`. Une copie typée (sans recopier les
      // octets) transmet le type vérifié, celui qu'attend l'espace de stockage.
      const { error } = await stockage.upload(chemin, fichier.slice(0, fichier.size, format), { contentType: format, upsert: false });
      if (error) {
        toast({ tone: "erreur", title: `L’envoi de « ${fichier.name} » n’a pas abouti.` });
        return;
      }
      let resultat: Resultat;
      try {
        resultat = await addRessource({ leconId: lecon.id, titre: sansExtension(fichier.name), fichier: chemin, format, tailleOctets: fichier.size });
      } catch {
        resultat = { ok: false };
      }
      if (!resultat.ok) {
        // Pas de fichier sans ressource : l'envoi est retiré.
        await stockage.remove([chemin]);
        toast({ tone: "erreur", title: resultat.message ?? `L’envoi de « ${fichier.name} » n’a pas abouti.` });
        return;
      }
      toast({ tone: "reussite", title: "Fichier ajouté" });
    } catch {
      toast({ tone: "erreur", title: `L’envoi de « ${fichier.name} » n’a pas abouti.` });
    } finally {
      setEnvois((liste) => liste.filter((e) => e.cle !== cle));
    }
  };

  return (
    <section aria-labelledby="ressources-titre" className="flex max-w-[680px] flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6">
      <Heading level="card" as="h2">
        <span id="ressources-titre">Ressources</span>
      </Heading>
      {lecon.ressources.length === 0 && envois.length === 0 ? (
        <p className="m-0 text-[13px] leading-5 text-discret">Aucun fichier pour cette leçon.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {lecon.ressources.map((r, index) => (
            <LigneRessource key={r.id} ressource={r} premier={index === 0} dernier={index === lecon.ressources.length - 1} />
          ))}
          {envois.map((e) => (
            <li key={e.cle}>
              <FileRow name={e.nom} meta={`${tailleLisible(e.taille)} · envoi en cours…`} />
            </li>
          ))}
        </ul>
      )}
      <FileDrop
        title="Déposez vos fichiers ici"
        maxSizeLabel="PDF, images, Excel, Word, PowerPoint, ZIP, CSV ou texte · 50 Mo au maximum"
        accept={ACCEPT}
        multiple
        onFiles={(fichiers) => fichiers.forEach((f) => void envoyer(f))}
      />
    </section>
  );
}
