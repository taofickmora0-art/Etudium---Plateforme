import type { Metadata } from "next";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { SignUpForm } from "@/components/auth/SignUpForm";

export const metadata: Metadata = { title: "Créer un compte · Étudium" };

/** Création de compte gratuite (NdInscription). */
export default function InscriptionPage() {
  return (
    <AuthLayout aside="inscription">
      <AuthHeading title="Créer votre compte gratuit">Accédez aux formations gratuites et suivez votre progression.</AuthHeading>
      <SignUpForm />
    </AuthLayout>
  );
}
