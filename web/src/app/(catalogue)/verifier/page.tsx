import type { Metadata } from "next";
import { FormulaireVerification } from "@/components/certificats/FormulaireVerification";
import { Heading, Lead } from "@/components/ui/Text";

export const metadata: Metadata = {
  title: "Vérifier un certificat · Étudium",
  description: "Vérifiez l’authenticité d’un certificat Étudium avec son identifiant ou son QR Code. Aucun compte n’est nécessaire.",
};

/** « Vérifier un certificat » (NdVerification) : ouverte à tous, sans compte. */
export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] min-w-0 flex-col gap-6 py-6">
      <div>
        <Heading level="page">Vérifier un certificat</Heading>
        <Lead className="mt-2.5">Scannez le QR Code du certificat ou saisissez son identifiant. Aucun compte n’est nécessaire.</Lead>
      </div>
      <div className="rounded-carte border border-bordure-carte bg-panneau p-6 max-sm:p-4">
        <FormulaireVerification />
      </div>
      <p className="m-0 text-sm leading-[22px] text-discret">
        Le résultat s’affiche sur une page à part, la même que celle du QR Code imprimé sur le certificat.
      </p>
    </div>
  );
}
