"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";
import { enregistrerParcours } from "@/lib/resultats/actions";
import { formaterNombre, lireNombre } from "@/lib/resultats/affichage";
import { REGLES_PAR_DEFAUT } from "@/lib/resultats/calcul";
import { refusRegles } from "@/lib/resultats/regles";
import type { ModeRattrapage, Parcours, Regles } from "@/lib/resultats/types";
import { categoriesDuBareme, ChoixBareme, etatBareme } from "./ChoixBareme";
import { FenetreSaisie } from "./FenetreSaisie";

/** Un parcours scolaire et les règles de son école : barème, seuil d'une UE, compensation, rattrapage (spec, §3). */
export function FenetreParcours({ parcours, onFermer }: { parcours?: Parcours; onFermer: () => void }) {
  const router = useRouter();
  const id = useId();
  const regles = parcours?.regles ?? REGLES_PAR_DEFAUT;
  const [nom, setNom] = useState(parcours?.nom ?? "");
  const [etablissement, setEtablissement] = useState(parcours?.etablissement ?? "");
  const [bareme, setBareme] = useState(() => etatBareme(regles.categories));
  const [seuilUe, setSeuilUe] = useState(formaterNombre(regles.seuilUe));
  const [compensation, setCompensation] = useState(regles.compensation);
  const [seuilSemestre, setSeuilSemestre] = useState(formaterNombre(regles.seuilSemestre));
  const [rattrapage, setRattrapage] = useState<ModeRattrapage>(regles.rattrapage);

  return (
    <FenetreSaisie
      titre={parcours ? "Le parcours et ses règles" : "Nouveau parcours"}
      bouton={parcours ? "Enregistrer" : "Créer le parcours"}
      onFermer={onFermer}
      envoyer={() => {
        const nouvelles: Regles = {
          seuilUe: lireNombre(seuilUe),
          seuilSemestre: compensation ? lireNombre(seuilSemestre) : regles.seuilSemestre,
          compensation,
          rattrapage,
          categories: categoriesDuBareme(bareme),
        };
        const refus = (!nom.trim() && "Donne un nom au parcours.") || refusRegles(nouvelles);
        if (refus) return { ok: false, message: refus };
        return enregistrerParcours({ ...(parcours ? { id: parcours.id } : {}), nom: nom.trim(), etablissement: etablissement.trim(), regles: nouvelles });
      }}
      onFait={(retour) => !parcours && retour.id && router.push(`/mes-resultats/${retour.id}`)}
    >
      <Field label="Nom du parcours" htmlFor={`${id}-nom`}>
        <TextInput id={`${id}-nom`} maxLength={120} placeholder="Licence en agronomie" value={nom} onChange={(e) => setNom(e.target.value)} />
      </Field>
      <Field label="Établissement" htmlFor={`${id}-etablissement`}>
        <TextInput id={`${id}-etablissement`} maxLength={120} placeholder="Université d’Abomey-Calavi" value={etablissement} onChange={(e) => setEtablissement(e.target.value)} />
      </Field>
      <ChoixBareme name={`${id}-bareme`} etat={bareme} onChange={setBareme} />
      <Field label="Note pour valider une UE (sur 20)" htmlFor={`${id}-seuil`}>
        <TextInput id={`${id}-seuil`} inputMode="decimal" value={seuilUe} onChange={(e) => setSeuilUe(e.target.value)} className="w-28" />
      </Field>
      <Switch
        label="Compensation entre les UE"
        description="Les UE d’un semestre sont acquises si sa moyenne atteint le seuil."
        checked={compensation}
        onCheckedChange={setCompensation}
      />
      {compensation && (
        <Field label="Moyenne du semestre pour compenser" htmlFor={`${id}-seuil-semestre`}>
          <TextInput id={`${id}-seuil-semestre`} inputMode="decimal" value={seuilSemestre} onChange={(e) => setSeuilSemestre(e.target.value)} className="w-28" />
        </Field>
      )}
      <RadioGroup
        label="Note de rattrapage"
        showLabel
        name={`${id}-rattrapage`}
        value={rattrapage}
        onValueChange={(v) => setRattrapage(v === "meilleure" ? "meilleure" : "remplace")}
        options={[
          { value: "remplace", label: "Elle remplace la note d’examen" },
          { value: "meilleure", label: "La meilleure des deux (examen ou rattrapage) compte" },
        ]}
      />
    </FenetreSaisie>
  );
}
