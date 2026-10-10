import { Suspense } from "react";
import type { Metadata } from "next";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { getShellUser } from "@/lib/auth/current-user";

export const metadata: Metadata = { title: "Profil · Étudium" };

async function MenuDuCompte() {
  const user = await getShellUser();
  return user ? <MobileProfileMenu user={user} /> : null;
}

/** Onglet « Profil » de la barre du bas : sur téléphone, il remplace le menu du rond de profil. */
export default function MenuPage() {
  return (
    <Suspense fallback={null}>
      <MenuDuCompte />
    </Suspense>
  );
}
