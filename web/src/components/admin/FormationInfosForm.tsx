"use client";

import { useId } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { saveFormationInfos } from "@/lib/admin/actions";
import type { EspaceEdition } from "@/lib/admin/espace";
import { urlCouverture } from "@/lib/couvertures/adresse";
import type { FormateurAdmin, FormationAdmin, ParcoursAdmin } from "@/lib/admin/types";
import { BADGES, NIVEAUX } from "@/lib/contenus/libelles";
import { CouvertureEditor } from "./CouvertureEditor";
import { CARTE_FORMULAIRE } from "./ParcoursForm";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(220px,calc((100%-16px)/2))),1fr))] gap-4";

type Props = {
  formation: FormationAdmin;
  parcours: ParcoursAdmin[];
  formateurs: FormateurAdmin[];
  /** Espace formateur : le contenu seulement ; les réglages de l'équipe sont montrés, pas modifiables. */
  espace?: EspaceEdition;
};

const ouiNon = (valeur: boolean) => (valeur ? "oui" : "non");

/** Les réglages qui reviennent à l'équipe, montrés au formateur (spec de l'espace formateur, §3). */
function ReglagesEquipe({ formation }: { formation: FormationAdmin }) {
  const titre = useId();
  const badge = BADGES.find((b) => b.value === formation.badge)?.label ?? "Aucun";
  const lignes = [
    `Gratuite : ${ouiNon(formation.gratuite)}`,
    `Prix : ${formation.prixFcfa === null ? "—" : `${formation.prixFcfa.toLocaleString("fr-FR")} FCFA`}`,
    `Disponible seule : ${ouiNon(formation.achatSepare)}`,
    `Badge : ${badge}`,
    `Seuil des vidéos : ${formation.seuilVideo} %`,
  ];
  return (
    <section aria-labelledby={titre} className="flex flex-col gap-2 rounded-champ border border-bordure-carte bg-page p-4">
      <h3 id={titre} className="m-0 text-sm leading-5 font-medium text-encre">
        Réglé par l’équipe Étudium
      </h3>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {lignes.map((ligne) => (
          <li key={ligne} className="text-[13px] leading-5 text-discret">
            {ligne}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Onglet « Informations » d'une formation (spec du lot 1, §4 et §10 ; spec de l'espace formateur, §3). */
export function FormationInfosForm({ formation, parcours, formateurs, espace = "admin" }: Props) {
  const equipe = espace === "admin";
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(saveFormationInfos);
  const adresseFixee = formation.publieeLe !== null;
  const coche = (champ: string, enregistre: boolean) => (state.values ? state.values[champ] === "on" : enregistre);
  const parcoursCoches = state.values ? (state.values.parcours ?? "").split(",").filter(Boolean) : formation.parcoursIds;

  // Couleur de la couverture par défaut : celle du premier parcours coché.
  const couleur = parcours.find((p) => p.id === formation.parcoursIds[0])?.couleur ?? "academique";

  return (
    <div className="flex flex-col gap-5">
      <CouvertureEditor formationId={formation.id} parcours={couleur} couverture={urlCouverture(formation.couverture)} />
      <form onSubmit={envoyer} noValidate className={CARTE_FORMULAIRE}>
        {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
        <input type="hidden" name="id" value={formation.id} />
        <input type="hidden" name="espace" value={espace} />
        <Field label="Titre" htmlFor="formation-titre" error={e.titre}>
          <TextInput id="formation-titre" name="titre" defaultValue={valeur("titre", formation.titre)} maxLength={120} required />
        </Field>
        <Field
          label="Adresse"
          htmlFor="formation-slug"
          hint={adresseFixee ? "Fixée depuis la publication : les liens partagés restent valables." : "Lettres minuscules, chiffres et tirets. Elle sera fixée à la publication."}
          error={e.slug}
        >
          <TextInput
            id="formation-slug"
            name="slug"
            defaultValue={valeur("slug", formation.slug)}
            readOnly={adresseFixee}
            maxLength={80}
            autoCapitalize="none"
            spellCheck={false}
          />
        </Field>
        <Field label="Résumé" htmlFor="formation-resume" hint="Deux lignes sous le titre, sur les cartes du catalogue." error={e.resume}>
          <Textarea id="formation-resume" name="resume" rows={2} defaultValue={valeur("resume", formation.resume)} maxLength={160} />
        </Field>
        <Field label="Description" htmlFor="formation-description" error={e.description}>
          <Textarea id="formation-description" name="description" rows={4} defaultValue={valeur("description", formation.description)} maxLength={2000} />
        </Field>
        <Field label="Ce que vous allez apprendre" htmlFor="formation-objectifs" hint="Un objectif par ligne." error={e.objectifs}>
          <Textarea id="formation-objectifs" name="objectifs" rows={5} defaultValue={valeur("objectifs", formation.objectifs.join("\n"))} />
        </Field>
        <Field label="Compétences acquises" htmlFor="formation-competences" hint="Une compétence par ligne." error={e.competences}>
          <Textarea id="formation-competences" name="competences" rows={4} defaultValue={valeur("competences", formation.competences.join("\n"))} />
        </Field>
        <div className={GRILLE}>
          <Field label="Niveau" htmlFor="formation-niveau" error={e.niveau}>
            <Select id="formation-niveau" name="niveau" options={NIVEAUX} defaultValue={valeur("niveau", formation.niveau)} />
          </Field>
          <Field label="Score minimal aux quiz (%)" htmlFor="formation-score-quiz" hint="Pour réussir chaque quiz de la formation." error={e.score_quiz}>
            <TextInput
              id="formation-score-quiz"
              name="score_quiz"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              defaultValue={valeur("score_quiz", String(formation.scoreQuiz))}
            />
          </Field>
          {equipe && (
            <>
              <Field label="Formateur" htmlFor="formation-formateur" error={e.formateur_id}>
                <Select
                  id="formation-formateur"
                  name="formateur_id"
                  options={[{ value: "", label: "Aucun" }, ...formateurs.map((f) => ({ value: f.id, label: f.nom }))]}
                  defaultValue={valeur("formateur_id", formation.formateurId)}
                />
              </Field>
              <Field label="Badge" htmlFor="formation-badge" error={e.badge}>
                <Select id="formation-badge" name="badge" options={[{ value: "", label: "Aucun" }, ...BADGES]} defaultValue={valeur("badge", formation.badge)} />
              </Field>
              <Field
                label="Seuil de validation des vidéos (%)"
                htmlFor="formation-seuil"
                hint="Part de la vidéo à regarder réellement pour terminer une leçon."
                error={e.seuil_video}
              >
                <TextInput id="formation-seuil" name="seuil_video" type="number" inputMode="numeric" min={50} max={100} defaultValue={valeur("seuil_video", String(formation.seuilVideo))} />
              </Field>
            </>
          )}
        </div>
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 p-0 text-sm leading-5 font-medium text-encre">Parcours</legend>
          {parcours.length === 0 ? (
            <p className="m-0 text-[13px] leading-5 text-discret">
              {equipe ? "Aucun parcours : créez-en un dans la rubrique Parcours." : "Aucun parcours pour le moment : l’équipe Étudium les crée."}
            </p>
          ) : (
            parcours.map((p) => <Checkbox key={p.id} name="parcours" value={p.id} label={p.nom} defaultChecked={parcoursCoches.includes(p.id)} />)
          )}
        </fieldset>
        {equipe ? (
          <>
            <Switch name="gratuite" label="Formation gratuite" description="Ouverte à tout compte, sans abonnement." defaultChecked={coche("gratuite", formation.gratuite)} />
            <Switch
              name="achat_separe"
              label="Disponible seule"
              description="Achat individuel, en formation complémentaire (lot 2)."
              defaultChecked={coche("achat_separe", formation.achatSepare)}
            />
            <Field label="Prix en FCFA" htmlFor="formation-prix" hint="Facultatif : le prix de l’achat individuel." error={e.prix_fcfa}>
              <TextInput
                id="formation-prix"
                name="prix_fcfa"
                type="number"
                inputMode="numeric"
                min={0}
                defaultValue={valeur("prix_fcfa", formation.prixFcfa === null ? "" : String(formation.prixFcfa))}
              />
            </Field>
          </>
        ) : (
          <ReglagesEquipe formation={formation} />
        )}
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
