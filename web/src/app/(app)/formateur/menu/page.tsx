import { Suspense } from "react";
import type { Metadata } from "next";
import { MobileProfileMenu } from "@/components/layout/MobileProfileMenu";
import { requireSpace } from "@/lib/auth/require-space";

export const metadata: Metadata = { title: "Profil · Espace formateur · Étudium" };

async function MenuDuCompte() {
  const user = await requireSpace("formateur");
  return <MobileProfileMenu user={user} espace="formateur" />;
}

/** Onglet « Profil » de la barre du bas, dans l'espace formateur (restructuration R1). */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <MenuDuCompte />
    </Suspense>
  );
}
