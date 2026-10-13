import { Suspense } from "react";
import type { Metadata } from "next";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { redirectToSortie } from "@/lib/auth/sortie";
import { getProfile } from "@/lib/profile/data";

export const metadata: Metadata = { title: "Mon profil · Étudium" };

async function ProfilDuCompte() {
  const profile = await getProfile();
  // Supabase ne reconnaît plus la session (fermée sur un autre appareil) : /auth/sortie l'efface de l'appareil.
  if (!profile) return redirectToSortie();
  return <ProfileTabs profile={profile} />;
}

/** Mon profil (NdProfil) : onglets Informations, Notifications et Sécurité. */
export default function ProfilPage() {
  return (
    <div className="flex flex-col">
      <Heading level="page">Mon profil</Heading>
      <Lead className="mt-2.5">Vos informations, vos préférences de notification et la sécurité de votre compte.</Lead>
      <div className="mt-[21px]">
        <Suspense fallback={<Skeleton className="h-12 w-[340px] max-w-full rounded-bouton" />}>
          <ProfilDuCompte />
        </Suspense>
      </div>
    </div>
  );
}
