"use client";

import { useActionState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { TextInput } from "@/components/ui/TextInput";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { authErrorMessage } from "@/lib/auth/messages";
import { IDLE, type FormState } from "@/lib/auth/schemas";
import { updateProfile } from "@/lib/profile/actions";
import type { ProfileData } from "@/lib/profile/data";
import { NIVEAUX, PAYS } from "@/lib/profile/options";
import { PhotoPicker } from "./PhotoPicker";

const CHOISIR = { value: "", label: "Choisir…" };
const GRILLE = "grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(220px,calc((100%-16px)/2))),1fr))] gap-4";

/** Onglet Informations (NdProfil) : photo, coordonnées, études et objectifs ; « Enregistrer » (NdProfilEnregistre). */
export function InformationsTab({ profile }: { profile: ProfileData }) {
  const { toast } = useToast();
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData): Promise<FormState> => {
    try {
      const resultat = await updateProfile(prev, formData);
      if (resultat.status === "success") toast({ tone: "reussite", title: "Modifications enregistrées" });
      return resultat;
    } catch {
      // Coupure réseau : on le dit et on garde la saisie, au lieu de l'écran d'erreur.
      const values = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
      return { status: "error", message: authErrorMessage(null), values };
    }
  }, IDLE);
  const e = state.fieldErrors ?? {};
  // Après un envoi, on garde la saisie (même en cas d'erreur) ; sinon, les valeurs enregistrées.
  const valeur = (champ: string, enregistre: string | null) => state.values?.[champ] ?? enregistre ?? "";

  return (
    <div className="flex max-w-[680px] flex-col gap-5 rounded-carte border border-bordure-carte bg-panneau p-6">
      <PhotoPicker initials={profile.initials} photoUrl={profile.photoUrl} name={`${profile.prenom} ${profile.nom}`} />
      <form action={action} noValidate className="flex flex-col gap-5">
        {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
        <div className={GRILLE}>
          <Field label="Prénom" htmlFor="profil-prenom" error={e.prenom}>
            <TextInput id="profil-prenom" name="prenom" autoComplete="given-name" defaultValue={valeur("prenom", profile.prenom)} required />
          </Field>
          <Field label="Nom" htmlFor="profil-nom" error={e.nom}>
            <TextInput id="profil-nom" name="nom" autoComplete="family-name" defaultValue={valeur("nom", profile.nom)} required />
          </Field>
          <Field label="Adresse e-mail" htmlFor="profil-email" hint="Utilisée pour vous connecter.">
            <TextInput id="profil-email" type="email" value={profile.email} readOnly />
          </Field>
          <Field label="Téléphone" htmlFor="profil-telephone" error={e.telephone}>
            <TextInput id="profil-telephone" name="telephone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={valeur("telephone", profile.telephone)} />
          </Field>
          <Field label="Pays" htmlFor="profil-pays" error={e.pays}>
            <Select id="profil-pays" name="pays" options={[CHOISIR, ...PAYS]} defaultValue={valeur("pays", profile.pays)} />
          </Field>
          <Field label="Niveau d’études" htmlFor="profil-niveau" error={e.niveau_etudes}>
            <Select id="profil-niveau" name="niveau_etudes" options={[CHOISIR, ...NIVEAUX]} defaultValue={valeur("niveau_etudes", profile.niveauEtudes)} />
          </Field>
          <Field label="Établissement" htmlFor="profil-etablissement" error={e.etablissement}>
            <TextInput id="profil-etablissement" name="etablissement" autoComplete="organization" defaultValue={valeur("etablissement", profile.etablissement)} />
          </Field>
          <Field label="Filière" htmlFor="profil-filiere" error={e.filiere}>
            <TextInput id="profil-filiere" name="filiere" defaultValue={valeur("filiere", profile.filiere)} />
          </Field>
        </div>
        <Field label="Objectifs d’apprentissage" htmlFor="profil-objectifs" error={e.objectifs}>
          <Textarea id="profil-objectifs" name="objectifs" rows={3} defaultValue={valeur("objectifs", profile.objectifs)} />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={pending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </div>
  );
}
