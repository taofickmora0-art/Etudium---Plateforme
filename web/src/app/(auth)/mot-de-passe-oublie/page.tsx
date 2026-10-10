import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ResetRequestForm } from "@/components/auth/ResetRequestForm";

export const metadata: Metadata = { title: "Mot de passe oublié · Étudium" };

type Params = Promise<{ lien?: string }>;

async function Formulaire({ searchParams }: { searchParams: Params }) {
  const { lien } = await searchParams;
  return <ResetRequestForm linkExpired={lien === "expire"} />;
}

/** Mot de passe oublié (NdMotDePasse, NdMotDePasseEnvoye). */
export default function MotDePasseOubliePage({ searchParams }: { searchParams: Params }) {
  return (
    <AuthLayout aside="compte" back={{ href: "/connexion", label: "Retour à la connexion" }}>
      <Suspense fallback={<ResetRequestForm />}>
        <Formulaire searchParams={searchParams} />
      </Suspense>
    </AuthLayout>
  );
}
