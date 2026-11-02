import { Suspense } from "react";
import type { Metadata } from "next";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { ProfileTabs } from "@/components/profile/ProfileTabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Heading, Lead } from "@/components/ui/Text";
import { redirectToSortie } from "@/lib/auth/sortie";
import { lireProgressionJeu } from "@/lib/engagement/data";
import { getProfile } from "@/lib/profile/data";
import { ongletProfil } from "@/lib/profile/onglets";

export const metadata: Metadata = { title: "Mon profil · Étudium" };

type Params = { searchParams: Promise<{ onglet?: string }> };

async function ProfilDuCompte({ searchParams }: Params) {
  const [profile, { onglet }, jeu] = await Promise.all([getProfile(), searchParams, lireProgressionJeu()]);
  // Supabase ne reconnaît plus la session (fermée sur un autre appareil) : /auth/sortie l'efface de l'appareil.
  if (!profile) return redirectToSortie();
  // La progression du jeu (lot 6 B) : la carte « Gamification » et l'objectif ; rien sans la migration 0063.
  return <ProfileTabs profile={profile} ongletInitial={ongletProfil(onglet)} jeu={jeu} />;
}

/** Mon profil (NdProfil) : onglets Informations, Notifications et Sécurité. */
export default function ProfilPage({ searchParams }: Params) {
  return (
    <div className="flex flex-col">
      <Heading level="page">Mon profil</Heading>
      <Lead className="mt-2.5">Vos informations, vos préférences de notification et la sécurité de votre compte.</Lead>
      <div className="mt-[21px]">
        <Suspense fallback={<Skeleton className="h-12 w-[340px] max-w-full rounded-bouton" />}>
          <ProfilDuCompte searchParams={searchParams} />
        </Suspense>
      </div>
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </div>
  );
}
