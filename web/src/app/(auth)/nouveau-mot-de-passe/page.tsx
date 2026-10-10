import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";

export const metadata: Metadata = { title: "Nouveau mot de passe · Étudium" };

/** Nouveau mot de passe (NdReinitialisation), ouvert depuis le lien reçu par e-mail. */
export default function NouveauMotDePassePage() {
  return (
    <AuthLayout aside="compte" back={{ href: "/connexion", label: "Retour à la connexion" }}>
      <NewPasswordForm />
    </AuthLayout>
  );
}
