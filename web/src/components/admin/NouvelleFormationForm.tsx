"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { createFormation } from "@/lib/admin/actions";
import { CARTE_FORMULAIRE } from "./ParcoursForm";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

/** Première étape : un titre suffit. La formation naît en brouillon ; le reste se saisit sur sa fiche. */
export function NouvelleFormationForm() {
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(createFormation, { succes: "Brouillon créé" });
  return (
    <form onSubmit={envoyer} noValidate className={CARTE_FORMULAIRE}>
      {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
      <Field label="Titre de la formation" htmlFor="formation-titre" hint="Vous pourrez le modifier ensuite." error={e.titre}>
        <TextInput id="formation-titre" name="titre" defaultValue={valeur("titre", "")} maxLength={120} required />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Créer le brouillon
        </Button>
      </div>
    </form>
  );
}
