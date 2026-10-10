import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LinkExpiredNotice } from "@/components/auth/FromAddress";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const metadata: Metadata = { title: "Mot de passe oublié · Étudium" };

/** Mot de passe oublié (NdMotDePasse, NdMotDePasseEnvoye). Page statique : `?lien=expire` est lu dans le navigateur. */
export default function MotDePasseOubliePage() {
  return (
    <AuthLayout aside="compte" back={{ href: "/connexion", label: "Retour à la connexion" }}>
      <ResetRequestForm notice={<LinkExpiredNotice />} />
    </AuthLayout>
  );
}
