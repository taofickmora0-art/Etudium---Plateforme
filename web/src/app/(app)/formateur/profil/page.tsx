import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { requireSpace } from "@/lib/auth/require-space";
import { redirectToSortie } from "@/lib/auth/sortie";
import { getProfile } from "@/lib/profile/data";
import { ongletProfil } from "@/lib/profile/onglets";

export const metadata: Metadata = { title: "Mon profil · Espace formateur · Étudium" };

type Params = { searchParams: Promise<{ onglet?: string }> };

async function ProfilDuCompte({ searchParams }: Params) {
  await requireSpace("formateur");
  const [profile, { onglet }] = await Promise.all([getProfile(), searchParams]);
  if (!profile) return redirectToSortie();
  return <ProfileTabs profile={profile} ongletInitial={ongletProfil(onglet)} />;
}

/** Mon profil, dans l'espace formateur (restructuration R1 : il n'a plus l'espace étudiant). Le même écran que l'étudiant. */
export default function ProfilFormateurPage({ searchParams }: Params) {
  return (
    <div className="flex flex-col">
      <Heading level="page">Mon profil</Heading>
      <Lead className="mt-2.5">Vos informations, vos préférences de notification et la sécurité de votre compte.</Lead>
      <div className="mt-[21px]">
        <Suspense fallback={<Skeleton className="h-12 w-[340px] max-w-full rounded-bouton" />}>
          <ProfilDuCompte searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
