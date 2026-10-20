import { Suspense } from "react";
import type { Metadata } from "next";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { SessionGuard } from "@/components/layout/SessionGuard";
import { getShellUser } from "@/lib/auth/current-user";
import { redirectToSortie } from "@/lib/auth/sortie";

export const metadata: Metadata = { title: "Profil · Étudium" };

async function MenuDuCompte() {
  const user = await getShellUser();
  // Session fermée ailleurs : /auth/sortie l'efface de l'appareil.
  if (!user) return redirectToSortie();
  return <MobileProfileMenu user={user} />;
}

/** Onglet « Profil » de la barre du bas : sur téléphone, il remplace le menu du rond de profil. */
export default function MenuPage() {
  return (
    <>
      <Suspense fallback={null}>
        <MenuDuCompte />
      </Suspense>
      {/* Un formateur va au menu de son espace (restructuration R1). */}
      <Suspense fallback={null}>
        <SessionGuard />
      </Suspense>
    </>
  );
}
