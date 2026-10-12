"use client";

import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { saveParcours } from "@/lib/admin/actions";
import type { ParcoursAdmin } from "@/lib/admin/types";
import { COULEURS } from "@/lib/contenus/libelles";
import { useFormulaireAdmin } from "./useFormulaireAdmin";

export const CARTE_FORMULAIRE = "flex max-w-[680px] flex-col gap-5 rounded-carte border border-bordure-carte bg-panneau p-6";

/** Création ou modification d'un parcours (spec du lot 1, §10). */
export function ParcoursForm({ parcours }: { parcours?: ParcoursAdmin }) {
  const { state, envoyer, pending, erreurs: e, valeur } = useFormulaireAdmin(saveParcours, { succes: parcours ? "Parcours enregistré" : "Parcours créé" });
  const actif = state.values ? state.values.actif === "on" : (parcours?.actif ?? true);
  return (
    <form onSubmit={envoyer} noValidate className={CARTE_FORMULAIRE}>
      {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
      {parcours && <input type="hidden" name="id" value={parcours.id} />}
      <Field label="Nom" htmlFor="parcours-nom" error={e.nom}>
        <TextInput id="parcours-nom" name="nom" defaultValue={valeur("nom", parcours?.nom)} maxLength={80} required />
      </Field>
      <Field label="Nom court" htmlFor="parcours-nom-court" hint="Affiché sur les puces, par exemple « Académique »." error={e.nom_court}>
        <TextInput id="parcours-nom-court" name="nom_court" defaultValue={valeur("nom_court", parcours?.nomCourt)} maxLength={30} required />
      </Field>
      <Field
        label="Adresse"
        htmlFor="parcours-slug"
        hint="Lettres minuscules, chiffres et tirets. Laissez vide pour la créer à partir du nom."
        error={e.slug}
      >
        <TextInput id="parcours-slug" name="slug" defaultValue={valeur("slug", parcours?.slug)} maxLength={80} autoCapitalize="none" spellCheck={false} />
      </Field>
      <Field label="Description" htmlFor="parcours-description" error={e.description}>
        <Textarea id="parcours-description" name="description" rows={3} defaultValue={valeur("description", parcours?.description)} maxLength={500} />
      </Field>
      <Field label="Couleur" htmlFor="parcours-couleur" error={e.couleur}>
        <Select id="parcours-couleur" name="couleur" options={COULEURS} defaultValue={valeur("couleur", parcours?.couleur ?? "academique")} />
      </Field>
      <Switch name="actif" label="Parcours actif" description="Un parcours désactivé disparaît du catalogue." defaultChecked={actif} />
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          {parcours ? "Enregistrer" : "Créer le parcours"}
        </Button>
      </div>
    </form>
  );
}
