"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { resendCode, verifyCode } from "@/lib/auth/actions";
import { IDLE, type FormState } from "@/lib/auth/schemas";
import { cn } from "@/lib/cn";
import { LIEN } from "./SignInForm";

/** Délai entre deux envois du code : à faire correspondre au réglage de Supabase (guide de branchement). */
export const RENVOI_SECONDES = 45;

const minutes = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Saisie du code reçu par e-mail (NdCodeVerification) ; envoi automatique dès le 6ᵉ chiffre. */
export function VerifyCodeForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(verifyCode, IDLE);
  const [code, setCode] = useState("");
  const [reste, setReste] = useState(RENVOI_SECONDES);
  // Après un renvoi réussi, le compte à rebours repart.
  const [renvoi, renvoyer, renvoiEnCours] = useActionState(async (prev: FormState) => {
    const resultat = await resendCode(prev);
    if (resultat.status === "success") setReste(RENVOI_SECONDES);
    return resultat;
  }, IDLE);
  const formulaire = useRef<HTMLFormElement>(null);

  // Compte à rebours avant de pouvoir redemander un code.
  useEffect(() => {
    const minuterie = setInterval(() => setReste((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(minuterie);
  }, []);

  const erreur = state.fieldErrors?.code ?? state.message;
  return (
    <>
      <p className="-mt-2 mb-0 text-[15px] leading-6 text-pretty text-discret">
        Nous avons envoyé un code à 6 chiffres à <strong className="font-semibold text-encre">{email}</strong>. Saisissez-le pour
        activer votre compte.
      </p>
      {renvoi.status !== "idle" && renvoi.message && (
        <Banner tone={renvoi.status === "success" ? "reussite" : "erreur"}>{renvoi.message}</Banner>
      )}
      <form ref={formulaire} action={action} className="flex flex-col gap-[18px]">
        <input type="hidden" name="code" value={code} />
        <CodeInput
          label="Code reçu par e-mail"
          value={code}
          onChange={setCode}
          onComplete={() => formulaire.current?.requestSubmit()}
          hint="Le code expire dans 10 minutes."
          error={state.status === "error" ? erreur : undefined}
          disabled={pending}
        />
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Vérifier
        </Button>
      </form>
      <form action={renvoyer}>
        <p className="m-0 text-center text-sm leading-[22px] text-discret">
          Vous n’avez rien reçu ?{" "}
          <button
            type="submit"
            disabled={reste > 0 || renvoiEnCours}
            className={cn(LIEN, "cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:text-discret disabled:no-underline")}
          >
            Renvoyer le code
          </button>
          {reste > 0 && <span> dans {minutes(reste)}</span>}
        </p>
      </form>
    </>
  );
}
