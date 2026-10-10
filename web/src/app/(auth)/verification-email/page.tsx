import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { AuthHeading, AuthLayout } from "@/components/auth/AuthLayout";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";
import { PENDING_EMAIL_COOKIE } from "@/lib/auth/session-cookies";

export const metadata: Metadata = { title: "Vérifiez votre adresse e-mail · Étudium" };

/** L'adresse à vérifier vient d'un cookie (jamais de l'URL) : lecture sous Suspense avec Cache Components. */
async function Contenu() {
  const email = (await cookies()).get(PENDING_EMAIL_COOKIE)?.value;
  if (!email) redirect("/inscription");
  return <VerifyCodeForm email={email} />;
}

/** Vérification de l'adresse par le code à 6 chiffres (NdCodeVerification). */
export default function VerificationPage() {
  return (
    <AuthLayout aside="inscription" back={{ href: "/inscription", label: "Modifier mon adresse" }}>
      <AuthHeading icon={Mail01Icon} title="Vérifiez votre adresse e-mail" />
      <Suspense fallback={null}>
        <Contenu />
      </Suspense>
    </AuthLayout>
  );
}
