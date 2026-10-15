"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { normaliserIdentifiant } from "@/lib/certificats/adresse";

const MAL_FORME = "Saisissez l’identifiant tel qu’il figure sur le certificat : ET-2026-XXXX-XXXX.";

/** « Identifiant du certificat » puis « Vérifier » (NdVerification) : mène à la page du résultat, la même que le QR Code. */
export function FormulaireVerification({ initial = "" }: { initial?: string }) {
  const id = useId();
  const router = useRouter();
  const [saisie, setSaisie] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);

  function verifier(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const identifiant = normaliserIdentifiant(saisie);
    if (!identifiant) return setErreur(MAL_FORME);
    setErreur(null);
    router.push(`/c/${identifiant}`);
  }

  return (
    <form onSubmit={verifier} noValidate className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={`${id}-identifiant`} className="text-sm leading-5 font-medium text-encre">
        Identifiant du certificat
      </label>
      <div className="flex flex-wrap gap-2">
        <TextInput
          id={`${id}-identifiant`}
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value);
            setErreur(null);
          }}
          placeholder="ET-2026-XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={erreur ? true : undefined}
          aria-describedby={erreur ? `${id}-erreur` : undefined}
          className="min-w-0 flex-[1_1_220px]"
        />
        <Button type="submit">Vérifier</Button>
      </div>
      {erreur && (
        <p id={`${id}-erreur`} role="alert" className="m-0 text-xs leading-[18px] text-erreur-texte">
          {erreur}
        </p>
      )}
    </form>
  );
}
