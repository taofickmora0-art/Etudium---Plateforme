"use client";

import { useActionState } from "react";
import Link from "next/link";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { updatePassword } from "@/lib/auth/actions";
import { IDLE } from "@/lib/auth/schemas";
import { AuthHeading } from "./AuthLayout";
import { LIEN } from "./SignInForm";

/** Nouveau mot de passe (NdReinitialisation), ouvert depuis le lien reçu par e-mail. */
export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, IDLE);
  const expire = state.message === "Ce lien a expiré. Demandez-en un nouveau.";
  return (
    <>
      <AuthHeading icon={SquareLock02Icon} title="Nouveau mot de passe">
        Choisissez un mot de passe que vous n’utilisez pas ailleurs.
      </AuthHeading>
      <form action={action} noValidate className="flex flex-col gap-[18px]">
        {state.status === "error" && state.message && (
          <Banner
            tone="erreur"
            title={state.message}
            action={
              expire ? (
                <Link href="/mot-de-passe-oublie" className={LIEN}>
                  Nouveau lien
                </Link>
              ) : undefined
            }
          />
        )}
        <Field label="Nouveau mot de passe" htmlFor="nouveau-mdp" hint="Au moins 8 caractères." error={state.fieldErrors?.password}>
          <PasswordInput id="nouveau-mdp" name="password" autoComplete="new-password" minLength={8} required />
        </Field>
        <Field label="Confirmer le mot de passe" htmlFor="nouveau-mdp-confirmation" error={state.fieldErrors?.confirmation}>
          <PasswordInput id="nouveau-mdp-confirmation" name="confirmation" autoComplete="new-password" required />
        </Field>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Enregistrer le mot de passe
        </Button>
      </form>
    </>
  );
}
