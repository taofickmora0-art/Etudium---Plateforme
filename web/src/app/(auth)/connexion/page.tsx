import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { SessionExpiredDialog } from "@/components/auth/SessionExpiredDialog";
import { SignInForm } from "@/components/auth/SignInForm";
import { Banner } from "@/components/ui/Banner";
import { CourseIllustration } from "@/components/ui/CourseIllustration";
import { safeNext } from "@/lib/auth/messages";

export const metadata: Metadata = { title: "Connexion · Étudium" };

type Params = Promise<{ next?: string; session?: string; erreur?: string }>;

/** Lit l'adresse (session expirée, retour de Google, page demandée) : sous Suspense avec Cache Components. */
async function Formulaire({ searchParams }: { searchParams: Params }) {
  const { next, session, erreur } = await searchParams;
  return (
    <>
      {session === "expiree" && <SessionExpiredDialog />}
      {erreur === "google" && (
        <Banner tone="erreur" title="La connexion avec Google n’a pas abouti.">
          Réessayez ou utilisez votre e-mail.
        </Banner>
      )}
      <SignInForm next={safeNext(next)} />
    </>
  );
}

/** Connexion (NdConnexion, NdConnexionErreur, NdSessionExpiree, NdMobConnexion). */
export default function ConnexionPage({ searchParams }: { searchParams: Params }) {
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
      <Suspense fallback={<SignInForm next="/accueil" />}>
        <Formulaire searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  );
}
