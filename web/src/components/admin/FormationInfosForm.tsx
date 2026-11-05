"use client";

import { useId } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";
import { saveFormationInfos } from "@/lib/admin/actions";
import type { EspaceEdition } from "@/lib/admin/espace";
import { urlCouverture } from "@/lib/couvertures/adresse";
import type { FormateurAdmin, FormationAdmin, ParcoursAdmin } from "@/lib/admin/types";
import { BADGES } from "@/lib/contenus/libelles";
import { InfosGenerales } from "@/components/editeur/InfosGenerales";
import type { EtatEdition, SaisieInfos } from "@/lib/editeur/types";
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
  /** Les formations publiées de Compétences digitales, pour « Compétences à vendre » (0048) ; absent : pas de rubrique. */
  competences?: { id: string; titre: string }[];
  /** Celles que cette formation apprend déjà à vendre. */
  liees?: string[];
};

const ouiNon = (valeur: boolean) => (valeur ? "oui" : "non");

/** Avant la 0056 : les informations en ligne (l'enregistrement automatique dira qu'il manque la migration). */
const editionParDefaut = (f: FormationAdmin): EtatEdition<SaisieInfos> => ({
  donnees: { titre: f.titre, resume: f.resume, description: f.description, objectifs: f.objectifs, competences: f.competences, niveau: f.niveau },
  revision: 0,
  brouillon: false,
  enLigne: f.statut !== "brouillon",
  modifiePar: null,
  modifieLe: null,
});

/** Les réglages qui reviennent à l'équipe, montrés au formateur (spec de l'espace formateur, §3). */
function ReglagesEquipe({ formation }: { formation: FormationAdmin }) {
  const titre = useId();
  const badge = BADGES.find((b) => b.value === formation.badge)?.label ?? "Aucun";
  const lignes = [
    `Gratuite : ${ouiNon(formation.gratuite)}`,
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

/**
 * Onglet « Informations » d'une formation (spec du lot 1, §4 et §10 ; spec de l'espace formateur, §3) : la couverture, les
 * informations générales (enregistrées seules, fin du lot 4), puis les réglages (bouton « Enregistrer »).
 */
export function FormationInfosForm({ formation, parcours, formateurs, espace = "admin", competences, liees = [] }: Props) {
  const equipe = espace === "admin";
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(saveFormationInfos);
  const adresseFixee = formation.publieeLe !== null;
  const coche = (champ: string, enregistre: boolean) => (state.values ? state.values[champ] === "on" : enregistre);
  const parcoursCoches = state.values ? (state.values.parcours ?? "").split(",").filter(Boolean) : formation.parcoursIds;
  const vendues = state.values ? (state.values.competences_vendues ?? "").split(",").filter(Boolean) : liees;
  // « Compétences à vendre » (restructuration, §5.3 ; 0078) : pour une formation de Compétences digitales ou d'Entrepreneuriat.
  const rubriqueMonetisation = competences !== undefined && parcours.some((p) => p.couleur === "digital" || p.couleur === "business");

  // Le score minimal aux quiz (0031) : absent avant elle, sinon chaque enregistrement buterait sur la colonne absente.
  const champScore = formation.scoreQuiz !== null && (
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
  );

  // Couleur de la couverture par défaut : celle du premier parcours coché.
  const couleur = parcours.find((p) => p.id === formation.parcoursIds[0])?.couleur ?? "academique";

  return (
    <div className="flex flex-col gap-5">
      <CouvertureEditor formationId={formation.id} parcours={couleur} couverture={urlCouverture(formation.couverture)} />
      {/* Le contenu (fin du lot 4) : enregistré tout seul, dans un brouillon si la formation est en ligne. */}
      <InfosGenerales formationId={formation.id} edition={formation.edition ?? editionParDefaut(formation)} />
      <form onSubmit={envoyer} noValidate className={CARTE_FORMULAIRE}>
        {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
        <h2 className="m-0 text-base leading-6 font-semibold text-encre">Réglages</h2>
        <input type="hidden" name="id" value={formation.id} />
        <input type="hidden" name="espace" value={espace} />
        {/* Le titre en ligne : il donne l'adresse quand le champ est vidé. */}
        <input type="hidden" name="titre" value={formation.titre} />
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
        <div className={GRILLE}>
          {/* Avant la 0033, le score reste ici ; ensuite, il rejoint la carte « Certification ». */}
          {formation.exercicesObligatoires === null && champScore}
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
        {/* La carte « Certification » (NdEditeur, 0033) : ce qu'il faut pour obtenir le certificat. */}
        {formation.exercicesObligatoires !== null && (
          <fieldset className="m-0 flex flex-col gap-4 rounded-champ border border-bordure-carte p-4">
            <legend className="px-1 text-sm leading-5 font-medium text-encre">Certification</legend>
            <p className="m-0 text-[13px] leading-5 text-discret">Le certificat est délivré quand toutes les leçons sont terminées, tous les quiz réussis et, si vous le demandez, tous les exercices validés.</p>
            <input type="hidden" name="certification" value="1" />
            <div className={GRILLE}>{champScore}</div>
            <Switch
              name="exercices_obligatoires"
              label="Exercices obligatoires"
              description="Tous les exercices publiés doivent être validés pour obtenir le certificat."
              defaultChecked={coche("exercices_obligatoires", formation.exercicesObligatoires)}
            />
            {e.exercices_obligatoires && (
              <p role="alert" className="m-0 text-xs leading-[18px] text-erreur-texte">
                {e.exercices_obligatoires}
              </p>
            )}
          </fieldset>
        )}
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
        {rubriqueMonetisation && (
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 p-0 text-sm leading-5 font-medium text-encre">Compétences à vendre</legend>
            <input type="hidden" name="monetisation" value="1" />
            <p className="m-0 mb-1 text-[13px] leading-5 text-discret">
              Pour une formation de Compétences digitales ou d’Entrepreneuriat : les compétences qu’elle apprend à vendre.
            </p>
            {competences.length === 0 ? (
              <p className="m-0 text-[13px] leading-5 text-discret">Aucune formation publiée dans Compétences digitales pour le moment.</p>
            ) : (
              competences.map((c) => <Checkbox key={c.id} name="competences_vendues" value={c.id} label={c.titre} defaultChecked={vendues.includes(c.id)} />)
            )}
            {e.competences_vendues && (
              <p role="alert" className="m-0 text-[13px] leading-5 text-erreur-texte">
                {e.competences_vendues}
              </p>
            )}
          </fieldset>
        )}
        {equipe ? (
          <>
            {/* Plus d'achat seul ni de prix par formation : l'abonnement ouvre tout (restructuration, §5.2). */}
            <Switch name="gratuite" label="Formation gratuite" description="Ouverte à tout compte, sans abonnement." defaultChecked={coche("gratuite", formation.gratuite)} />
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
