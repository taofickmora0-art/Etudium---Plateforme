"use client";

import { useFormStatus } from "react-dom";
import { GoogleIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/Button";
import { signInWithGoogle } from "@/lib/auth/actions";
import { NextField } from "./FromAddress";

function Bouton({ dansLeFormulaire = false }: { dansLeFormulaire?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="contour"
      size="lg"
      iconLeft={GoogleIcon}
      loading={pending}
      className="w-full"
      formAction={dansLeFormulaire ? signInWithGoogle : undefined}
    >
      Continuer avec Google
    </Button>
  );
}

/** « Continuer avec Google » (NdConnexion, NdInscription) : un compte Google sans profil Étudium en crée un. */
export function GoogleButton({ inForm = false }: { inForm?: boolean }) {
  // Dans le formulaire de connexion : part chez Google avec ses champs (page demandée, « Se souvenir de moi »).
  if (inForm) return <Bouton dansLeFormulaire />;
  return (
    <form action={signInWithGoogle}>
      <NextField />
      {/* Pas de case « Se souvenir de moi » à l'inscription : on se souvient. */}
      <input type="hidden" name="remember" value="on" />
      <Bouton />
    </form>
  );
}

/** Séparateur « ou » entre deux façons de se connecter. */
export function OrDivider({ label = "ou" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-separateur" />
      <span className="text-[13px] leading-5 text-discret">{label}</span>
      <span className="h-px flex-1 bg-separateur" />
    </div>
  );
}
