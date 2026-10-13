import { Suspense } from "react";
import { comingSoonMetadata } from "@/components/layout/ComingSoon";
import { ReservedComingSoon } from "@/components/layout/ReservedComingSoon";

export const metadata = comingSoonMetadata("formateur/messages");

/** Réservée aux rôles de l'espace (lib/auth/permissions) : un autre compte est renvoyé vers l'accueil. */
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReservedComingSoon espace="formateur" page="formateur/messages" />
    </Suspense>
  );
}
