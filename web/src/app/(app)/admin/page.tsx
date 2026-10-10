import { Suspense } from "react";
import { comingSoonMetadata } from "@/components/layout/ComingSoon";
import { ReservedComingSoon } from "@/components/layout/ReservedComingSoon";

export const metadata = comingSoonMetadata("admin");

/** Réservée aux rôles concernés (lib/auth/permissions) : un étudiant est renvoyé vers l'accueil. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReservedComingSoon espace="admin" page="admin" />
    </Suspense>
  );
}
