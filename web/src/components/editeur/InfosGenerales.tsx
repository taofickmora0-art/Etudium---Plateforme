"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { NIVEAUX } from "@/lib/contenus/libelles";
import { enregistrerInfosFormation } from "@/lib/editeur/actions";
import type { EtatEdition, SaisieInfos } from "@/lib/editeur/types";
import { IndicateurSauvegarde } from "./IndicateurSauvegarde";
import { useSauvegardeAuto } from "./useSauvegardeAuto";

/**
 * Les informations générales d'une formation (fin du lot 4, spec §2.2) : titre, résumé, description, objectifs,
 * compétences, niveau. Enregistrées toutes seules ; une formation en ligne, dans son brouillon, jusqu'à « Publier les
 * modifications ». Les réglages (adresse, formateur, badge…) restent dans la carte « Réglages ».
 */
export function InfosGenerales({ formationId, edition }: { formationId: string; edition: EtatEdition<SaisieInfos> }) {
  // La carte ne repart de la base que si elle a une révision plus récente que celle qu'elle connaît (Publier,
  // Abandonner, Restaurer, un autre auteur) : un rafraîchissement après sa propre sauvegarde ne la recharge pas.
  const [connue, setConnue] = useState(edition.revision);
  const [generation, setGeneration] = useState(0);
  if (edition.revision > connue) {
    setConnue(edition.revision);
    setGeneration((g) => g + 1);
  }
  return <Carte key={`${formationId}:${generation}`} formationId={formationId} edition={edition} surEnregistre={(r) => setConnue((c) => Math.max(c, r))} />;
}

function Carte({ formationId, edition, surEnregistre }: { formationId: string; edition: EtatEdition<SaisieInfos>; surEnregistre: (revision: number) => void }) {
  const id = useId();
  const initiale = edition.donnees;
  const [titre, setTitre] = useState(initiale.titre);
  const [resume, setResume] = useState(initiale.resume);
  const [description, setDescription] = useState(initiale.description);
  const [objectifs, setObjectifs] = useState(initiale.objectifs.join("\n"));
  const [competences, setCompetences] = useState(initiale.competences.join("\n"));
  const [niveau, setNiveau] = useState(initiale.niveau);
  const saisie = useMemo<SaisieInfos>(
    () => ({ titre, resume, description, objectifs: objectifs.split("\n"), competences: competences.split("\n"), niveau }),
    [titre, resume, description, objectifs, competences, niveau],
  );
  const router = useRouter();
  const sauvegarde = useSauvegardeAuto({
    cle: `formation:${formationId}`,
    valeur: saisie,
    revisionInitiale: edition.revision,
    brouillonInitial: edition.brouillon,
    enregistrer: (valeur, revision) => enregistrerInfosFormation(formationId, valeur, revision),
    surEnregistre,
  });
  const { etat } = sauvegarde;
  const e: Record<string, string> = etat.type === "invalide" ? etat.erreurs : {};
  const recuperer = () => {
    const v = sauvegarde.recuperer();
    if (!v) return;
    setTitre(v.titre);
    setResume(v.resume);
    setDescription(v.description);
    setObjectifs(v.objectifs.join("\n"));
    setCompetences(v.competences.join("\n"));
    setNiveau(v.niveau);
  };
  const quitter = () => void sauvegarde.enregistrerMaintenant();

  return (
    <section aria-labelledby={`${id}-titre`} className="flex flex-col gap-4 rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h2 id={`${id}-titre`} className="m-0 text-base leading-6 font-semibold text-encre">
          Informations générales
        </h2>
        {sauvegarde.brouillon && <Tag tone="aCorriger">Modifications non publiées</Tag>}
        <IndicateurSauvegarde etat={etat} className="ml-auto" />
      </div>
      {etat.type === "conflit" && (
        <Banner
          tone="erreur"
          title={`Ces informations viennent d’être modifiées par ${etat.par ?? "quelqu’un d’autre"}.`}
          action={
            <Button size="sm" variant="contour" onClick={() => router.refresh()}>
              Recharger
            </Button>
          }
        >
          Rechargez pour voir sa version. Ce que vous venez d’écrire reste gardé sur cet appareil.
        </Banner>
      )}
      {sauvegarde.recuperation && (
        <Banner
          tone="information"
          title={
            sauvegarde.recuperation.ancienne
              ? "Des modifications de cet appareil, faites sur une version plus ancienne, n’ont pas été enregistrées. Les récupérer remplace la version actuelle."
              : "Des modifications de cet appareil n’ont pas été enregistrées."
          }
          action={<RecupererIgnorer onRecuperer={recuperer} onIgnorer={sauvegarde.ignorer} />}
        />
      )}
      {e.formulaire && <Banner tone="erreur" title={e.formulaire} />}
      <Field label="Titre" htmlFor={`${id}-t`} error={e.titre}>
        <TextInput id={`${id}-t`} value={titre} maxLength={120} required onChange={(ev) => setTitre(ev.target.value)} onBlur={quitter} />
      </Field>
      <Field label="Résumé" htmlFor={`${id}-r`} hint="Deux lignes sous le titre, sur les cartes du catalogue." error={e.resume}>
        <Textarea id={`${id}-r`} rows={2} value={resume} maxLength={160} onChange={(ev) => setResume(ev.target.value)} onBlur={quitter} />
      </Field>
      <Field label="Description" htmlFor={`${id}-d`} error={e.description}>
        <Textarea id={`${id}-d`} rows={4} value={description} maxLength={2000} onChange={(ev) => setDescription(ev.target.value)} onBlur={quitter} />
      </Field>
      <Field label="Ce que vous allez apprendre" htmlFor={`${id}-o`} hint="Un objectif par ligne." error={e.objectifs}>
        <Textarea id={`${id}-o`} rows={5} value={objectifs} onChange={(ev) => setObjectifs(ev.target.value)} onBlur={quitter} />
      </Field>
      <Field label="Compétences acquises" htmlFor={`${id}-c`} hint="Une compétence par ligne." error={e.competences}>
        <Textarea id={`${id}-c`} rows={4} value={competences} onChange={(ev) => setCompetences(ev.target.value)} onBlur={quitter} />
      </Field>
      <Field label="Niveau" htmlFor={`${id}-n`} error={e.niveau} className="max-w-[320px]">
        <Select id={`${id}-n`} options={NIVEAUX} value={niveau} onChange={(ev) => setNiveau(ev.target.value as SaisieInfos["niveau"])} onBlur={quitter} />
      </Field>
    </section>
  );
}

function RecupererIgnorer({ onRecuperer, onIgnorer }: { onRecuperer: () => void; onIgnorer: () => void }) {
  return (
    <span className="flex flex-wrap gap-2">
      <Button size="sm" onClick={onRecuperer}>
        Récupérer
      </Button>
      <Button size="sm" variant="contour" onClick={onIgnorer}>
        Ignorer
      </Button>
    </span>
  );
}
