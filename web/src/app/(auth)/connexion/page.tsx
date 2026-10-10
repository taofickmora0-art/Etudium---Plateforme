import type { Metadata } from "next";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { SignInNotices } from "@/components/auth/FromAddress";
import { SignInForm } from "@/components/auth/SignInForm";
import { CourseIllustration } from "@/components/ui/CourseIllustration";

export const metadata: Metadata = { title: "Connexion · Étudium" };

/**
 * Connexion (NdConnexion, NdConnexionErreur, NdSessionExpiree, NdMobConnexion).
 * Page statique : l'adresse (session expirée, retour de Google, page demandée) est lue dans le navigateur.
 */
export default function ConnexionPage() {
  return (
    <AuthLayout aside="connexion">
      <AuthHeading
        title="Content de vous revoir"
        illustration={
          <span className="lg:hidden">
            <CourseIllustration parcours="academique" size={56} />
          </span>
        }
      >
        Connectez-vous pour reprendre votre apprentissage.
      </AuthHeading>
      <SignInNotices />
      <SignInForm />
    </AuthLayout>
  );
}
