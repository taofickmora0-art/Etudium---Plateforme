"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { TextInput } from "@/components/ui/TextInput";
import { signIn } from "@/lib/auth/actions";
import { IDLE } from "@/lib/auth/schemas";
import { NextField } from "./FromAddress";
import { GoogleButton, OrDivider } from "./GoogleButton";

const IDENTIFIANTS_INCORRECTS = "E-mail ou mot de passe incorrect.";
export const LIEN = "focus-etudium text-sm leading-[22px] font-medium text-bleu no-underline hover:underline";

/** Formulaire de connexion (NdConnexion, NdConnexionErreur). */
export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, IDLE);
  return (
    <>
      <form action={action} noValidate className="flex flex-col gap-[18px]">
        {state.status === "error" && state.message && (
          <Banner tone="erreur" title={state.message}>
            {state.message === IDENTIFIANTS_INCORRECTS ? "Vérifiez vos identifiants, puis réessayez." : null}
          </Banner>
        )}
        <NextField />
        <Field label="Adresse e-mail" htmlFor="connexion-email" error={state.fieldErrors?.email}>
          <TextInput
            id="connexion-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="vous@exemple.com"
            defaultValue={state.values?.email}
            required
          />
        </Field>
        <Field label="Mot de passe" htmlFor="connexion-mdp" error={state.fieldErrors?.password}>
          <PasswordInput id="connexion-mdp" name="password" autoComplete="current-password" required />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Checkbox name="remember" label="Se souvenir de moi" defaultChecked />
          <Link href="/mot-de-passe-oublie" className={LIEN}>
            Mot de passe oublié ?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Se connecter
        </Button>
      </form>
      <OrDivider />
      <GoogleButton />
      <p className="m-0 text-center text-sm leading-[22px] text-discret">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className={LIEN}>
          Créer un compte
        </Link>
      </p>
    </>
  );
}
