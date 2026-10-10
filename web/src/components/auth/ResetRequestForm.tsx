"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Mail01Icon, SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { TextInput } from "@/components/ui/TextInput";
import { requestReset } from "@/lib/auth/actions";
import { IDLE } from "@/lib/auth/schemas";
import { AuthHeading } from "./AuthLayout";
import { LIEN } from "./SignInForm";

/** « Mot de passe oublié » (NdMotDePasse), puis « Vérifiez votre boîte de réception » (NdMotDePasseEnvoye). */
export function ResetRequestForm({ linkExpired = false }: { linkExpired?: boolean }) {
  const [state, action, pending] = useActionState(requestReset, IDLE);

  if (state.status === "success") {
    const email = state.values?.email ?? "";
    return (
      <>
        <AuthHeading icon={Mail01Icon} iconTone="reussite" title="Vérifiez votre boîte de réception">
          Si un compte existe pour {email}, vous allez recevoir un lien pour choisir un nouveau mot de passe. Pensez à regarder dans les
          courriers indésirables.
        </AuthHeading>
        <Button asChild size="lg" className="w-full">
          <Link href="/connexion">Retour à la connexion</Link>
        </Button>
        <form action={action}>
          <input type="hidden" name="email" value={email} />
          <Button type="submit" variant="contour" size="lg" loading={pending} className="w-full">
            Renvoyer le lien
          </Button>
        </form>
      </>
    );
  }

  return (
    <>
      <AuthHeading icon={SquareLock02Icon} title="Mot de passe oublié">
        Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.
      </AuthHeading>
      {linkExpired && state.status === "idle" && <Banner tone="attention" title="Ce lien a expiré.">Demandez-en un nouveau.</Banner>}
      <form action={action} noValidate className="flex flex-col gap-[18px]">
        {state.status === "error" && state.message && <Banner tone="erreur" title={state.message} />}
        <Field label="Adresse e-mail" htmlFor="oubli-email" error={state.fieldErrors?.email}>
          <TextInput
            id="oubli-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="vous@exemple.com"
            defaultValue={state.values?.email}
            required
          />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Envoyer le lien
        </Button>
      </form>
      <p className="m-0 text-center text-sm leading-[22px] text-discret">
        Vous vous en souvenez ?{" "}
        <Link href="/connexion" className={LIEN}>
          Se connecter
        </Link>
      </p>
    </>
  );
}
