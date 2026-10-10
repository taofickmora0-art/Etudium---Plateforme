"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { TextInput } from "@/components/ui/TextInput";
import { signUp } from "@/lib/auth/actions";
import { IDLE } from "@/lib/auth/schemas";
import { GoogleButton, OrDivider } from "./GoogleButton";
import { LIEN } from "./SignInForm";

/** Création de compte (NdInscription) : Google, ou e-mail avec prénom, nom, mot de passe et conditions. */
export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, IDLE);
  const e = state.fieldErrors ?? {};
  return (
    <>
      <GoogleButton />
      <OrDivider label="ou avec votre e-mail" />
      <form action={action} noValidate className="flex flex-col gap-[18px]">
        {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
        {/* Prénom et nom côte à côte, l'un sous l'autre sur un écran étroit (NdInscription). */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,max(150px,calc((100%-14px)/2))),1fr))] gap-3.5">
          <Field label="Prénom" htmlFor="inscription-prenom" error={e.prenom}>
            <TextInput id="inscription-prenom" name="prenom" autoComplete="given-name" defaultValue={state.values?.prenom} required />
          </Field>
          <Field label="Nom" htmlFor="inscription-nom" error={e.nom}>
            <TextInput id="inscription-nom" name="nom" autoComplete="family-name" defaultValue={state.values?.nom} required />
          </Field>
        </div>
        <Field label="Adresse e-mail" htmlFor="inscription-email" error={e.email}>
          <TextInput
            id="inscription-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            defaultValue={state.values?.email}
            required
          />
        </Field>
        <Field label="Mot de passe" htmlFor="inscription-mdp" hint="Au moins 8 caractères." error={e.password}>
          <PasswordInput id="inscription-mdp" name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <div className="flex flex-col gap-1.5">
          <Checkbox
            name="conditions"
            aria-invalid={e.conditions ? true : undefined}
            aria-describedby={e.conditions ? "inscription-conditions-erreur" : undefined}
            label={
              <>
                J’accepte les{" "}
                <Link href="/conditions" target="_blank" className={LIEN}>
                  conditions d’utilisation
                </Link>{" "}
                et la{" "}
                <Link href="/confidentialite" target="_blank" className={LIEN}>
                  politique de confidentialité
                </Link>
                .
              </>
            }
          />
          {e.conditions && (
            <span id="inscription-conditions-erreur" className="text-xs leading-[18px] text-erreur-texte">
              {e.conditions}
            </span>
          )}
        </div>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Créer mon compte
        </Button>
      </form>
      <p className="m-0 text-center text-sm leading-[22px] text-discret">
        Déjà inscrit ?{" "}
        <Link href="/connexion" className={LIEN}>
          Se connecter
        </Link>
      </p>
    </>
  );
}
