"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { saveFormateur } from "@/lib/admin/actions";
import type { FormateurAdmin } from "@/lib/admin/types";
import { CARTE_FORMULAIRE } from "./ParcoursForm";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

/** Fiche publique d'un formateur (spec du lot 1, Q7) ; elle sera reliée à son compte au lot 4. */
export function FormateurForm({ formateur }: { formateur?: FormateurAdmin }) {
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(saveFormateur, { succes: formateur ? "Fiche enregistrée" : "Fiche créée" });
  return (
    <form onSubmit={envoyer} noValidate className={CARTE_FORMULAIRE}>
      {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
      {formateur && <input type="hidden" name="id" value={formateur.id} />}
      <Field label="Nom" htmlFor="formateur-nom" error={e.nom}>
        <TextInput id="formateur-nom" name="nom" defaultValue={valeur("nom", formateur?.nom)} maxLength={80} required />
      </Field>
      <Field label="Titre" htmlFor="formateur-titre" hint="Par exemple « Enseignante en statistiques appliquées »." error={e.titre}>
        <TextInput id="formateur-titre" name="titre" defaultValue={valeur("titre", formateur?.titre)} maxLength={120} />
      </Field>
      <Field label="Domaine" htmlFor="formateur-domaine" hint="Par exemple « Statistiques appliquées · Analyse de données »." error={e.domaine}>
        <TextInput id="formateur-domaine" name="domaine" defaultValue={valeur("domaine", formateur?.domaine)} maxLength={120} />
      </Field>
      <Field label="Présentation" htmlFor="formateur-presentation" hint="Quelques lignes, affichées sur la fiche des formations." error={e.presentation}>
        <Textarea id="formateur-presentation" name="presentation" rows={4} defaultValue={valeur("presentation", formateur?.presentation)} maxLength={600} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {formateur ? "Enregistrer" : "Créer la fiche"}
        </Button>
      </div>
    </form>
  );
}
